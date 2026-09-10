import { defineConfig, devices } from '@playwright/test';

const mutation = process.env.QA_MUTATION === '1';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: mutation ? 'mutation-results' : 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: mutation ? 'mutation-report' : 'playwright-report', open: 'never' }],
    ['json', { outputFile: mutation ? 'mutation-results/results.json' : 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node app/server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
