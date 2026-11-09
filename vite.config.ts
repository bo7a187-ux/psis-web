import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Content-Security-Policy added to the built page: the app may not open any
// network connection, so project data can never leave the computer.
const CSP = "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";

export default defineConfig(({ mode }) => ({
  base: './',
  assetsInclude: ['**/*.xlsx'],
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html: string) =>
        html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
    },
    ...(mode === 'single' ? [viteSingleFile()] : []),
  ],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}));
