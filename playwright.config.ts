import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
let devPort = 3000;
const noServer = process.env.PLAYWRIGHT_NO_SERVER === '1' || process.env.PLAYWRIGHT_NO_SERVER === 'true';
try {
  const u = new URL(baseURL);
  devPort = Number(u.port) || (u.protocol === 'https:' ? 443 : 3000);
} catch {}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: noServer
    ? undefined
    : {
        command: `PORT=${devPort} npm run dev`,
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
