import {defineConfig} from '@playwright/test';
import common from './playwright.config';
if (!process.env.EFORGE_E2E_BACKEND_URL) throw new Error('Live E2E requires the disposable integration backend URL.');
// Never persist real seed-account credentials/tokens in uploaded browser traces.
export default defineConfig({...common, use: {...common.use, trace: 'off'}, testDir: './tests/live', fullyParallel: false, workers: 1});
