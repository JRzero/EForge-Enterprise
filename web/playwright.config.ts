import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', outputDir: './test-results/fixtures', fullyParallel: true, retries: 0,
  use: {...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure'},
  webServer: {command: 'npm run dev -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false},
  reporter: [['list']]
});
