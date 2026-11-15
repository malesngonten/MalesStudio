/**
 * Repository Research Service
 * Mengakses, memahami, dan mengintegrasikan source code dari repository
 * eksternal (GitHub, dll.) ke dalam project Remotion aktif.
 *
 * Semua operasi berjalan di workspace terisolasi per project di
 * .males_ngonten/repo-research/. Tidak ada eksekusi otomatis script
 * dari repository eksternal tanpa pemeriksaan keamanan.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  RepoFileInfo,
  RepoResearchResult,
  RepoReadResult,
  RepoResearchOptions,
} from '../types';

const execAsync = promisify(exec);

const RESEARCH_BASE = path.join(process.cwd(), '.males_ngonten', 'repo-research');

const MAX_DEFAULT_FILES = 200;
const MAX_DEFAULT_FILE_SIZE = 200_000; // 200KB

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  '.vscode',
  '.idea',
  'coverage',
  '.turbo',
]);

const SKIP_FILES = new Set([
  '.gitignore',
  '.eslintrc',
  '.prettierrc',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.txt',
  '.css',
  '.scss',
  '.html',
  '.toml',
  '.yaml',
  '.yml',
  '.env.example',
  '.gitattributes',
]);

function isTextFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (fileName === 'Dockerfile' || fileName === 'Makefile') return true;
  return false;
}

function getLanguageFromExt(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.mdx': 'MDX',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.html': 'HTML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
  };
  return map[ext];
}

/**
 * Parse GitHub URL to extract owner and repo name.
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = repoUrl.trim().replace(/\.git$/, '');
    const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

function repoDir(repoUrl: string): string {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    // Fallback: hash the URL
    const hash = Buffer.from(repoUrl).toString('hex').slice(0, 12);
    return path.join(RESEARCH_BASE, `repo-${hash}`);
  }
  return path.join(RESEARCH_BASE, `${parsed.owner}-${parsed.repo}`);
}

function ensureResearchBase(): void {
  if (!fs.existsSync(RESEARCH_BASE)) {
    fs.mkdirSync(RESEARCH_BASE, { recursive: true });
  }
}

/**
 * Clone repository GitHub publik ke workspace lokal.
 * Jika sudah ada, tidak clone ulang (kecuali force).
 */
async function cloneRepository(repoUrl: string, targetDir: string): Promise<void> {
  ensureResearchBase();

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    // Repo sudah ada, coba pull update
    try {
      await execAsync(`git -C "${targetDir}" pull --depth=1`, {
        timeout: 60000,
      });
    } catch {
      // Jika pull gagal, abaikan (gunakan yang sudah ada)
    }
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  await execAsync(
    `git clone --depth=1 "${repoUrl}" "${targetDir}"`,
    { timeout: 120000 }
  );
}

/**
 * Secara rekursif kumpulkan daftar file dari direktori.
 * Melewati node_modules, .git, dll.
 */
function collectFiles(dir: string, baseDir: string, files: RepoFileInfo[]): void {
  if (files.length >= (MAX_DEFAULT_FILES)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= MAX_DEFAULT_FILES) return;

    // Skip direktori yang tidak diinginkan
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(path.join(dir, entry.name), baseDir, files);
      continue;
    }

    // Skip file yang tidak diinginkan
    if (SKIP_FILES.has(entry.name)) continue;
    if (!isTextFile(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_DEFAULT_FILE_SIZE) continue;

      files.push({
        path: relPath,
        type: 'file',
        size: stat.size,
        language: getLanguageFromExt(entry.name),
      });
    } catch {
      // Skip file yang tidak bisa dibaca
    }
  }
}

/**
 * Baca isi file dari cloned repo.
 */
function readRepoFile(repoUrl: string, filePath: string): RepoReadResult {
  const targetDir = repoDir(repoUrl);
  const fullPath = path.join(targetDir, filePath);

  // Path traversal protection
  const resolved = path.resolve(fullPath);
  const baseResolved = path.resolve(targetDir);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    return { path: filePath, content: '', size: 0, error: 'Path traversal forbidden' };
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { path: filePath, content: '', size: 0, error: 'File not found' };
  }

  try {
    const stat = fs.statSync(resolved);
    if (stat.size > MAX_DEFAULT_FILE_SIZE) {
      return {
        path: filePath,
        content: '',
        size: stat.size,
        error: `File too large (${stat.size} bytes, max ${MAX_DEFAULT_FILE_SIZE})`,
      };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { path: filePath, content, size: stat.size };
  } catch (err: any) {
    return { path: filePath, content: '', size: 0, error: err?.message || 'Failed to read file' };
  }
}

/**
 * Riset repository GitHub publik.
 * Clone, baca README/SKILL.md, kumpulkan daftar file.
 */
export async function repoResearch(
  repoUrl: string,
  options: RepoResearchOptions = {}
): Promise<RepoResearchResult> {
  const maxFiles = options.maxFiles ?? MAX_DEFAULT_FILES;
  const maxFileSize = options.maxFileSize ?? MAX_DEFAULT_FILE_SIZE;

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return {
      repoUrl,
      repoName: '',
      localPath: '',
      files: [],
      structure: '',
      error: 'Invalid GitHub URL. Format: https://github.com/owner/repo',
    };
  }

  const targetDir = repoDir(repoUrl);

  try {
    await cloneRepository(repoUrl, targetDir);
  } catch (err: any) {
    return {
      repoUrl,
      repoName: parsed.repo,
      localPath: targetDir,
      files: [],
      structure: '',
      error: `Gagal clone repository: ${err?.message || String(err)}`,
    };
  }

  const files: RepoFileInfo[] = [];
  collectFiles(targetDir, targetDir, files);
  console.log('[WebResearch] collectFiles found', files.length, 'files in', repoUrl);
  // Batasi jumlah file sesuai opsi
  files.splice(maxFiles);

  // Baca README.md
  let readme: string | undefined;
  const readmePath = path.join(targetDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    try {
      const stat = fs.statSync(readmePath);
      if (stat.size <= maxFileSize) {
        readme = fs.readFileSync(readmePath, 'utf-8');
      }
    } catch {}
  }

  // Baca SKILL.md
  let skillMd: string | undefined;
  const skillPath = path.join(targetDir, 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    try {
      const stat = fs.statSync(skillPath);
      if (stat.size <= maxFileSize) {
        skillMd = fs.readFileSync(skillPath, 'utf-8');
      }
    } catch {}
  }

  // Bangun struktur direktori (hanya 2 level untuk ringkasan)
  const structureLines: string[] = [];
  const topLevel: string[] = [];
  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      topLevel.push(entry.isDirectory() ? `📁 ${entry.name}/` : `📄 ${entry.name}`);
    }
    topLevel.sort();
    structureLines.push(...topLevel.slice(0, 30));
  } catch {}

  return {
    repoUrl,
    repoName: parsed.repo,
    localPath: targetDir,
    files,
    readme,
    skillMd,
    structure: structureLines.join('\n'),
  };
}

/**
 * Baca file tertentu dari repository yang sudah di-clone.
 */
export async function repoReadFile(
  repoUrl: string,
  filePath: string
): Promise<RepoReadResult> {
  const targetDir = repoDir(repoUrl);

  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    return {
      path: filePath,
      content: '',
      size: 0,
      error: 'Repository belum di-clone. Panggil repoResearch terlebih dahulu.',
    };
  }

  return readRepoFile(repoUrl, filePath);
}

/**
 * Daftar file dalam repository yang sudah di-clone.
 */
export async function repoListFiles(
  repoUrl: string,
  subPath?: string
): Promise<RepoFileInfo[]> {
  const targetDir = repoDir(repoUrl);
  const searchDir = subPath ? path.join(targetDir, subPath) : targetDir;

  const files: RepoFileInfo[] = [];
  if (fs.existsSync(searchDir)) {
    collectFiles(searchDir, targetDir, files);
  }
  return files;
}
