import {defineConfig} from 'vite';
export default defineConfig({
  server: {proxy: Object.fromEntries(['/api', '/captchaImage', '/logout', '/profile', '/druid/', '/swagger-ui', '/v3/api-docs'].map(path =>
    // Preserve the browser-facing Host so same-origin POSTs stay same-origin
    // at Spring's CORS boundary. Do not weaken backend origin defaults.
    [path, {target: process.env.EFORGE_E2E_BACKEND_URL ?? 'http://127.0.0.1:8080', changeOrigin: false}]))},
  build: {rollupOptions: {onwarn(warning, warn) {
    // These directives target server-component frameworks; this app is a browser SPA.
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
    warn(warning);
  }}}
});
