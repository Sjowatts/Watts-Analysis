import { defineConfig, devices } from '@playwright/test';

// `npm test` serves this checkout the way GitHub Pages does and tests it.
// `npm run test:live` points the same suite at the published site.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/Watts-Analysis/';
const isLocal = !process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: isLocal ? 0 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // repo.spec.js only reads files, so it runs once, under desktop.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /repo\.spec\.js/ },
  ],
  webServer: isLocal
    ? { command: 'node tests/serve.js', url: baseURL, reuseExistingServer: !process.env.CI }
    : undefined,
});
