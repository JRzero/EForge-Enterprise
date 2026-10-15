import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

// A separate config intentionally has no development proxy, source transform,
// custom static handler, or copied files. Vite serves only the actual dist root.
// Run sequentially with playwright.live.config.ts, which also owns port 4176.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  appType: 'spa',
  build: {outDir: 'dist'},
  preview: {host: '127.0.0.1', port: 4176, strictPort: true, proxy: {}}
});
