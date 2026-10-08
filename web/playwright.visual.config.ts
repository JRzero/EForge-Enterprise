import {defineConfig, devices} from '@playwright/test';
// Opt-in, read-only audit of the already running local preview. No fixture DDL,
// permission edits, scheduled executions, cache clears, or data writes.
if (!process.env.EFORGE_VISUAL_TOKEN) throw new Error('A separately issued local visual-audit session is required.');
export default defineConfig({
  testDir:'./tests/visual', outputDir:'./test-results/visual', workers:1,
  timeout:60_000, retries:0, reporter:[['list']],
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5174',trace:'off',video:'off',viewport:{width:1440,height:1000}}
});
