import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'remocn-alias-resolver',
        enforce: 'pre',
        resolveId(id) {
          const remocnDir = path.resolve(__dirname, 'src/remotion/elements/remocn');
          const fallbackPath = path.resolve(__dirname, 'src/remotion/elements/remocn-lib/fallback-element.tsx');

          if (id === '@/lib/remocn-ui' || id.endsWith('/remocn-lib/remocn-ui') || id.endsWith('/remocn-lib/remocn-ui.ts')) {
            return path.resolve(__dirname, 'src/remotion/elements/remocn-lib/remocn-ui.ts');
          }

          if (
            id.startsWith('@/components/remocn/') ||
            id.startsWith('@/registry/remocn/') ||
            id.startsWith('@/lib/remocn/') ||
            id.startsWith(remocnDir + '/') ||
            id.startsWith(remocnDir + '\\')
          ) {
            let sub = id;
            if (sub.startsWith(remocnDir + '/') || sub.startsWith(remocnDir + '\\')) {
              sub = sub.slice(remocnDir.length).replace(/^[/\\]/, '');
            } else {
              sub = sub.replace(/^@\/(components|registry|lib)\/remocn\//, '');
            }

            if (!sub) return undefined;

            const ext = path.extname(sub);
            const baseSub = ext ? sub.slice(0, -ext.length) : sub;

            const candidates = [
              path.resolve(remocnDir, baseSub + '.tsx'),
              path.resolve(remocnDir, baseSub + '.ts'),
              path.resolve(remocnDir, baseSub, 'index.tsx'),
              path.resolve(remocnDir, baseSub, 'index.ts'),
              path.resolve(remocnDir, sub),
            ];
            for (const c of candidates) {
              if (fs.existsSync(c)) return c;
            }
            return fallbackPath;
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@/components/remocn': path.resolve(__dirname, 'src/remotion/elements/remocn'),
        '@/components/docs/examples': path.resolve(__dirname, 'src/remotion/elements/docs-examples'),
        '@/registry/remocn-templates': path.resolve(__dirname, 'src/remotion/elements/remocn-templates'),
        '@/registry/remocn-icons': path.resolve(__dirname, 'src/remotion/elements/remocn-icons'),
        '@/registry/remocn-ui': path.resolve(__dirname, 'src/remotion/elements/remocn-ui'),
        '@/registry/__manifest__': path.resolve(__dirname, 'src/remotion/elements/remocn-lib/__manifest__'),
        '@/registry/__index__': path.resolve(__dirname, 'src/remotion/elements/remocn-lib/__index__'),
        '@/lib/remocn-ui': path.resolve(__dirname, 'src/remotion/elements/remocn-lib/remocn-ui'),
        '@/lib/remocn': path.resolve(__dirname, 'src/remotion/elements/remocn'),
        '@/lib': path.resolve(__dirname, 'src/remotion/elements/remocn-lib'),
        '@/registry/remocn': path.resolve(__dirname, 'src/remotion/elements/remocn'),
        '@/registry-artifacts': path.resolve(__dirname, 'src/remotion/elements/registry-artifacts'),
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Ignore chat session files & render output so saving them doesn't trigger page reload.
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : {
            ignored: [
              '**/.males_ngonten/**',
              '**/out/**',
              '**/node_modules/**',
              '**/projects/**',
            ],
          },
    },
  };
});
