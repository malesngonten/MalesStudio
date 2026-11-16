/**
 * Project component compiler.
 *
 * Komponen fork (src/components/*.element.tsx) dan komponen hasil adaptasi
 * repository adalah kode runtime yang ditulis AI setelah aplikasi berjalan.
 * Browser tidak bisa mengeksekusi TSX mentah, jadi file dikompilasi ke
 * CommonJS dengan esbuild lalu dievaluasi memakai React/Remotion dari bundle
 * aplikasi.
 *
 * Dipakai oleh server (preview lewat /api/project-component) dan render-cli
 * (menempelkan kode komponen ke inputProps sebelum render).
 */
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';

const WORKSPACE = path.resolve(process.cwd());

const EXTERNAL_MODULES = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'remotion',
]);

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];

/** Cari file modul dengan ekstensi/index yang lazim dipakai Vite. */
function findCandidate(basePath) {
  const candidates = [
    basePath,
    ...EXTENSIONS.map((ext) => basePath + ext),
    ...EXTENSIONS.map((ext) => path.join(basePath, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // abaikan
    }
  }
  return null;
}

function isInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

/**
 * Alias mengikuti tsconfig.json aplikasi utama. Alias menunjuk ke library
 * remocn di workspace aplikasi, bukan ke folder project pengguna.
 */
function createAliasRules(workspaceRoot) {
  const elements = path.join(workspaceRoot, 'src', 'remotion', 'elements');
  return [
    { prefix: '@/components/remocn/', targets: [path.join(elements, 'remocn')] },
    { prefix: '@/components/docs/examples/', targets: [path.join(elements, 'docs-examples')] },
    { prefix: '@/registry/remocn-templates/', targets: [path.join(elements, 'remocn-templates')] },
    { prefix: '@/registry/remocn-icons/', targets: [path.join(elements, 'remocn-icons')] },
    { prefix: '@/registry/remocn-ui/', targets: [path.join(elements, 'remocn-ui')] },
    { prefix: '@/registry/remocn/', targets: [path.join(elements, 'remocn')] },
    { prefix: '@/registry-artifacts/', targets: [path.join(elements, 'registry-artifacts')] },
    { prefix: '@/lib/remocn/', targets: [path.join(elements, 'remocn')] },
    { prefix: '@/lib/', targets: [path.join(elements, 'remocn-lib')] },
    {
      prefix: '@/registry/__manifest__',
      exact: true,
      targets: [path.join(elements, 'remocn-lib', '__manifest__')],
    },
    {
      prefix: '@/registry/__index__',
      exact: true,
      targets: [path.join(elements, 'remocn-lib', '__index__')],
    },
    {
      prefix: '@/lib/remocn-ui',
      exact: true,
      targets: [
        path.join(elements, 'remocn-lib', 'remocn-ui.ts'),
        path.join(elements, 'remocn-lib', 'remocn-ui'),
      ],
    },
    { prefix: '@/', targets: [workspaceRoot] },
  ];
}

function resolveAlias(specifier, aliasRules, workspaceRoot) {
  for (const rule of aliasRules) {
    if (rule.exact) {
      if (specifier !== rule.prefix) continue;
    } else if (!specifier.startsWith(rule.prefix)) {
      continue;
    }
    const rest = rule.exact ? '' : specifier.slice(rule.prefix.length);
    for (const target of rule.targets) {
      const basePath = rest ? path.join(target, rest) : target;
      if (!isInside(workspaceRoot, basePath)) continue;
      const found = findCandidate(basePath);
      if (found) return found;
    }
  }
  return null;
}

function createRestrictionPlugin({ projectDir, workspaceRoot, aliasRules }) {
  const srcDir = path.join(projectDir, 'src');
  return {
    name: 'males-project-scope',
    setup(buildApi) {
      buildApi.onResolve({ filter: /.*/ }, (args) => {
        const specifier = args.path;

        // Entry point adalah path absolut yang diberikan compiler sendiri.
        if (args.kind === 'entry-point') return undefined;

        if (EXTERNAL_MODULES.has(specifier) || specifier.startsWith('react-dom/')) {
          return { path: specifier, external: true };
        }

        // Deny akses file absolut / file:// dari komponen project.
        if (specifier.startsWith('/') || specifier.startsWith('file:')) {
          return { errors: [{ text: `Import tidak diizinkan: ${specifier}` }] };
        }

        const alias = resolveAlias(specifier, aliasRules, workspaceRoot);
        if (alias) {
          return { path: alias };
        }

        // Relative import dari komponen project hanya boleh di dalam src/ project.
        // Package npm tetap di-resolve dari node_modules workspace aplikasi.
        if (specifier.startsWith('.')) {
          const importer = args.importer || '';
          const isProjectFile = isInside(projectDir, importer);
          const absolute = path.resolve(args.resolveDir, specifier);
          if (isProjectFile && !isInside(srcDir, absolute)) {
            return {
              errors: [
                {
                  text: `Import keluar dari src/ project tidak diizinkan: ${specifier}`,
                },
              ],
            };
          }
        }

        return undefined;
      });
    },
  };
}

/**
 * Kompilasi satu komponen project menjadi CommonJS.
 *
 * @param {object} options
 * @param {string} options.projectDir folder project aktif
 * @param {string} [options.workspaceRoot] folder aplikasi (node_modules & lib remocn)
 * @param {string} options.relativePath path relatif terhadap projectDir, mis. src/components/x.element.tsx
 * @param {boolean} [options.requireComponentsDir] batasi entry ke src/components/
 * @returns {Promise<{ code: string; cacheKey: string; absolutePath: string }>}
 */
export async function compileProjectComponent({
  projectDir,
  workspaceRoot = WORKSPACE,
  relativePath,
  requireComponentsDir = false,
}) {
  const srcDir = path.join(projectDir, 'src');
  const componentsDir = path.join(srcDir, 'components');
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  if (!normalized || normalized.includes('..')) {
    throw new Error('Path komponen tidak valid.');
  }

  const absolutePath = path.resolve(projectDir, normalized);

  if (!isInside(srcDir, absolutePath)) {
    throw new Error('Komponen harus berada di dalam src/ project.');
  }
  if (requireComponentsDir && !isInside(componentsDir, absolutePath)) {
    throw new Error('Komponen harus berada di dalam src/components/ project.');
  }
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File komponen tidak ditemukan: ${normalized}`);
  }
  if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(absolutePath)) {
    throw new Error('File komponen harus berekstensi .tsx/.ts/.jsx/.js.');
  }

  const stat = fs.statSync(absolutePath);
  const cacheKey = `${absolutePath}:${stat.mtimeMs}:${stat.size}`;
  const aliasRules = createAliasRules(workspaceRoot);

  const result = await build({
    entryPoints: [absolutePath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    logLevel: 'silent',
    sourcemap: false,
    minify: false,
    absWorkingDir: workspaceRoot,
    external: Array.from(EXTERNAL_MODULES),
    plugins: [createRestrictionPlugin({ projectDir, workspaceRoot, aliasRules })],
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.webp': 'dataurl',
      '.svg': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const jsOutput =
    (result.outputFiles || []).find((file) => !/\.(css|map)$/i.test(file.path)) ||
    (result.outputFiles || [])[0];
  if (!jsOutput) {
    throw new Error('Kompilasi tidak menghasilkan JavaScript.');
  }

  return { code: jsOutput.text, cacheKey, absolutePath };
}
