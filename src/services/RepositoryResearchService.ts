/**
 * Repository Research Service
 * Mengakses, memahami, dan mengintegrasikan source code dari repository
 * eksternal (GitHub, dll.) ke dalam project Remotion aktif.
 *
 * Semua operasi berjalan di workspace terisolasi di
 * .males_ngonten/repo-research/. Tidak ada eksekusi otomatis script
 * dari repository eksternal tanpa pemeriksaan keamanan.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  RepoDoc,
  RepoFileInfo,
  RepoResearchResult,
  RepoReadResult,
  RepoResearchOptions,
  RepoSearchMatch,
  RepoSearchResult,
} from '../types';

const execFileAsync = promisify(execFile);

const RESEARCH_BASE = path.join(process.cwd(), '.males_ngonten', 'repo-research');

const MAX_DEFAULT_FILES = 200;
const MAX_DEFAULT_FILE_SIZE = 200_000; // 200KB
const MAX_DOC_CHARS = 24_000;
const MAX_SEARCH_RESULTS = 24;

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
  '.cache',
  'vendor',
]);

const SKIP_FILES = new Set([
  '.gitignore',
  '.eslintrc',
  '.prettierrc',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.txt',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
  '.vue',
  '.svelte',
  '.toml',
  '.yaml',
  '.yml',
  '.xml',
  '.svg',
  '.env.example',
  '.gitattributes',
]);

const DOC_BASENAMES = new Set(['SKILL.md', 'AGENTS.md', 'CLAUDE.md']);

function isTextFile(fileName: string): boolean {
  const base = path.basename(fileName);
  const ext = path.extname(fileName).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (base === 'Dockerfile' || base === 'Makefile' || base === 'README' || base === 'LICENSE') {
    return true;
  }
  return false;
}

function getLanguageFromExt(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.mdx': 'MDX',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'SCSS',
    '.less': 'LESS',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.xml': 'XML',
    '.svg': 'SVG',
  };
  return map[ext];
}

/**
 * Parse GitHub URL to extract owner and repo name.
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 *
 * Owner/repo divalidasi ketat karena nilainya diteruskan ke git CLI.
 */
function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = repoUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2];
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

function repoDir(repoUrl: string): string {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
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

/** Pastikan path hasil resolve masih berada di dalam root repo (anti path traversal). */
function safeResolveInside(root: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath || '.');
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return resolved;
}

/**
 * Clone repository GitHub publik ke workspace lokal.
 * Jika sudah ada, coba pull update; kalau gagal pakai salinan yang ada.
 */
async function cloneRepository(repoUrl: string, targetDir: string): Promise<void> {
  ensureResearchBase();

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    try {
      await execFileAsync('git', ['-C', targetDir, 'pull', '--depth=1'], {
        timeout: 60000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
    } catch {
      // Gunakan salinan yang sudah ada.
    }
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  await execFileAsync('git', ['clone', '--depth=1', repoUrl, targetDir], {
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

/**
 * Kumpulkan daftar file (termasuk aset non-teks) secara rekursif.
 * Symlink dilewati agar repository tidak bisa membaca file di luar workspace.
 */
function collectFiles(
  dir: string,
  baseDir: string,
  files: RepoFileInfo[],
  limit: number = MAX_DEFAULT_FILES,
  depth: number = 0
): void {
  if (files.length >= limit || depth > 10) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (files.length >= limit) return;
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(path.join(dir, entry.name), baseDir, files, limit, depth + 1);
      continue;
    }

    if (SKIP_FILES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');

    try {
      const stat = fs.lstatSync(fullPath);
      if (!stat.isFile()) continue;
      files.push({
        path: relPath,
        type: 'file',
        size: stat.size,
        language: getLanguageFromExt(entry.name),
      });
    } catch {
      // Skip file yang tidak bisa dibaca.
    }
  }
}

function buildStructure(rootDir: string, maxLines: number = 100): string {
  const lines: string[] = [];

  const walk = (dir: string, prefix: string, depth: number) => {
    if (lines.length >= maxLines || depth > 2) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (lines.length >= maxLines) return;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}/`);
        walk(path.join(dir, entry.name), prefix + '  ', depth + 1);
      } else {
        if (SKIP_FILES.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}`);
      }
    }
  };

  walk(rootDir, '', 0);
  if (lines.length >= maxLines) lines.push('... (struktur dipotong)');
  return lines.join('\n');
}

function readTextCapped(fullPath: string, maxChars: number = MAX_DOC_CHARS): string | undefined {
  try {
    const stat = fs.lstatSync(fullPath);
    if (!stat.isFile() || stat.size > MAX_DEFAULT_FILE_SIZE) return undefined;
    const text = fs.readFileSync(fullPath, 'utf-8');
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n/* ... dipotong pada ${maxChars} karakter ... */`;
  } catch {
    return undefined;
  }
}

function findRootFile(rootDir: string, names: string[]): string | undefined {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(rootDir);
  } catch {
    return undefined;
  }
  for (const name of names) {
    const exact = entries.find((entry) => entry === name);
    if (exact) return path.join(rootDir, exact);
  }
  for (const name of names) {
    const insensitive = entries.find((entry) => entry.toLowerCase() === name.toLowerCase());
    if (insensitive) return path.join(rootDir, insensitive);
  }
  return undefined;
}

/**
 * Baca dokumen instruksi: README root + semua SKILL.md/AGENTS.md/CLAUDE.md
 * (maksimal 6 dokumen) agar AI memahami workflow repository.
 */
function collectDocs(rootDir: string, maxFileSize: number): RepoDoc[] {
  const docs: RepoDoc[] = [];
  const seen = new Set<string>();

  const pushDoc = (fullPath: string) => {
    const rel = path.relative(rootDir, fullPath).split(path.sep).join('/');
    if (seen.has(rel)) return;
    seen.add(rel);
    const content = readTextCapped(fullPath, Math.min(MAX_DOC_CHARS, maxFileSize));
    if (content) docs.push({ path: rel, content });
  };

  const readme = findRootFile(rootDir, ['README.md', 'README.MD', 'README.mdx', 'README.txt', 'README']);
  if (readme) pushDoc(readme);

  // Cari instruction files di subdirektori (mis. .claude/skills/*/SKILL.md).
  const walkForDocs = (dir: string, depth: number) => {
    if (docs.length >= 6 || depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (docs.length >= 6) return;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walkForDocs(path.join(dir, entry.name), depth + 1);
      } else if (DOC_BASENAMES.has(entry.name)) {
        pushDoc(path.join(dir, entry.name));
      }
    }
  };
  walkForDocs(rootDir, 0);

  return docs;
}

function readLicense(rootDir: string): string | undefined {
  const licensePath = findRootFile(rootDir, [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'COPYING',
    'COPYING.md',
  ]);
  if (!licensePath) return undefined;
  const text = readTextCapped(licensePath, 4000);
  return text;
}

function readPackageJson(rootDir: string): string | undefined {
  const packagePath = findRootFile(rootDir, ['package.json']);
  if (!packagePath) return undefined;
  return readTextCapped(packagePath, 20_000);
}

/**
 * Baca isi file dari cloned repo.
 */
function readRepoFile(repoUrl: string, filePath: string): RepoReadResult {
  const targetDir = repoDir(repoUrl);
  const resolved = safeResolveInside(targetDir, filePath);

  if (!resolved) {
    return { path: filePath, content: '', size: 0, error: 'Path traversal forbidden' };
  }

  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      return { path: filePath, content: '', size: 0, error: 'Symlink tidak diizinkan' };
    }
    if (!stat.isFile()) {
      return { path: filePath, content: '', size: 0, error: 'File not found' };
    }
    if (stat.size > MAX_DEFAULT_FILE_SIZE) {
      return {
        path: filePath,
        content: '',
        size: stat.size,
        error: `File too large (${stat.size} bytes, max ${MAX_DEFAULT_FILE_SIZE})`,
      };
    }
    if (!isTextFile(filePath)) {
      return {
        path: filePath,
        content: '',
        size: stat.size,
        error: 'File biner tidak bisa dibaca sebagai teks. Gunakan metadata dari repoListFiles.',
      };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { path: filePath, content, size: stat.size };
  } catch (err: any) {
    return {
      path: filePath,
      content: '',
      size: 0,
      error: err?.message || 'Failed to read file',
    };
  }
}

/**
 * Riset repository GitHub publik.
 * Clone, baca README + instruction files, lisensi, package.json, daftar file.
 */
export async function repoResearch(
  repoUrl: string,
  options: RepoResearchOptions = {}
): Promise<RepoResearchResult> {
  const maxFiles = Math.min(options.maxFiles ?? MAX_DEFAULT_FILES, 500);
  const maxFileSize = options.maxFileSize ?? MAX_DEFAULT_FILE_SIZE;

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return {
      repoUrl,
      repoName: '',
      localPath: '',
      files: [],
      structure: '',
      error: 'URL GitHub tidak valid. Format: https://github.com/owner/repo',
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
  collectFiles(targetDir, targetDir, files, maxFiles);

  const docs = collectDocs(targetDir, maxFileSize);
  const readmeDoc = docs.find((doc) => doc.path.toLowerCase().startsWith('readme'));
  const skillDoc = docs.find((doc) => doc.path.toLowerCase().endsWith('skill.md'));

  return {
    repoUrl,
    repoName: parsed.repo,
    localPath: targetDir,
    files,
    readme: readmeDoc?.content,
    skillMd: skillDoc?.content,
    docs,
    license: readLicense(targetDir),
    packageJson: readPackageJson(targetDir),
    structure: buildStructure(targetDir),
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
  subPath?: string,
  limit: number = MAX_DEFAULT_FILES
): Promise<RepoFileInfo[]> {
  const targetDir = repoDir(repoUrl);
  if (!fs.existsSync(path.join(targetDir, '.git'))) return [];

  const searchDir = safeResolveInside(targetDir, subPath || '.');
  if (!searchDir || !fs.existsSync(searchDir)) return [];

  const files: RepoFileInfo[] = [];
  let isDirectory = false;
  try {
    isDirectory = fs.lstatSync(searchDir).isDirectory();
  } catch {}
  if (isDirectory) {
    collectFiles(searchDir, targetDir, files, Math.min(limit, 500));
  }
  return files;
}

/**
 * Cari file di repository berdasarkan path dan isi teks.
 * Mengembalikan potongan baris yang cocok, bukan seluruh isi file.
 */
export async function repoSearchFiles(
  repoUrl: string,
  query: string,
  subPath?: string,
  limit: number = MAX_SEARCH_RESULTS
): Promise<RepoSearchResult> {
  const targetDir = repoDir(repoUrl);
  const cleanedQuery = (query || '').trim();

  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    return {
      repoUrl,
      query: cleanedQuery,
      matches: [],
      total: 0,
      error: 'Repository belum di-clone. Panggil repoResearch terlebih dahulu.',
    };
  }
  if (cleanedQuery.length < 2) {
    return {
      repoUrl,
      query: cleanedQuery,
      matches: [],
      total: 0,
      error: 'Query pencarian terlalu pendek.',
    };
  }

  const searchRoot = safeResolveInside(targetDir, subPath || '.');
  if (!searchRoot) {
    return {
      repoUrl,
      query: cleanedQuery,
      matches: [],
      total: 0,
      error: 'Path traversal forbidden',
    };
  }

  const terms = cleanedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 6);

  const allFiles: RepoFileInfo[] = [];
  collectFiles(searchRoot, targetDir, allFiles, 800, 0);

  const scored: Array<{ score: number; match: RepoSearchMatch }> = [];

  for (const file of allFiles) {
    if (file.size && file.size > MAX_DEFAULT_FILE_SIZE) continue;
    if (!isTextFile(file.path)) continue;

    const lowerPath = file.path.toLowerCase();
    let pathScore = 0;
    for (const term of terms) {
      if (lowerPath.includes(term)) pathScore += 8;
    }

    let content = '';
    try {
      content = fs.readFileSync(path.join(targetDir, file.path), 'utf-8');
    } catch {
      continue;
    }
    if (!content) continue;

    const lowerContent = content.toLowerCase();
    const lines = content.split(/\r?\n/);
    let contentScore = 0;
    const matchingLines: Array<{ line: number; text: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      let matchedTerm = false;
      for (const term of terms) {
        if (lowerLine.includes(term)) {
          matchedTerm = true;
          contentScore += 1;
        }
      }
      if (matchedTerm && matchingLines.length < 3) {
        matchingLines.push({ line: i + 1, text: lines[i].trim().slice(0, 240) });
      }
    }

    if (matchingLines.length === 0 && pathScore === 0) continue;

    const score = pathScore + Math.min(contentScore, 30);
    for (const match of matchingLines) {
      scored.push({
        score,
        match: { path: file.path, line: match.line, text: match.text },
      });
    }
    if (matchingLines.length === 0) {
      scored.push({
        score,
        match: { path: file.path, line: 1, text: '(nama file cocok)' },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.match.path.localeCompare(b.match.path));
  const matches = scored.slice(0, Math.min(limit, 100)).map((item) => item.match);

  return {
    repoUrl,
    query: cleanedQuery,
    matches,
    total: scored.length,
  };
}
