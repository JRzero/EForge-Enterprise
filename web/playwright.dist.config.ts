import {defineConfig, devices} from '@playwright/test';

/** Run against the already-built release files, never Vite's development server. */
export default defineConfig({
  testDir: './tests/release', testMatch: '**/*.spec.ts', outputDir: './test-results/dist',
  fullyParallel: false, workers: 1, retries: 0,
  use: {...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure', serviceWorkers: 'block'},
  webServer: {
    command: 'npm run preview:dist', url: 'http://127.0.0.1:4176', reuseExistingServer: false
  },
  reporter: [['list']]
});
