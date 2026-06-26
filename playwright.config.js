// NeoTopia · Playwright E2E config (T3 S6).
// Scope: realtime reconnect proofs. testMatch is '*.e2e.js' so these files are invisible to Vitest
// (whose default include is *.test/*.spec) · the two runners never fight over the same file.
// Reconnect tests mutate shared realtime state · they run SERIALLY (one worker, not parallel).

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  // After the whole suite: authenticated purge of residual E2E/bot test data (T3 S9 · global-teardown.js).
  globalTeardown: './tests/e2e/global-teardown.js',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
