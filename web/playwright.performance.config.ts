import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/performance',outputDir:'./test-results/performance',workers:1,retries:0,timeout:120000,
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:4187',serviceWorkers:'block',trace:'retain-on-failure'},
  webServer:{command:'npx vite preview --config tests/release/preview.config.ts --port 4187',url:'http://127.0.0.1:4187',reuseExistingServer:false},
  reporter:[['list']]
});
