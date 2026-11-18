import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'payroll-real.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4188', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../backend/tests/helpers/payrollPreview.js', url: 'http://127.0.0.1:5191/health', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4188 --strictPort', url: 'http://127.0.0.1:4188',
      env: { VITE_API_BASE: 'http://127.0.0.1:5191' }, reuseExistingServer: false },
  ],
});
