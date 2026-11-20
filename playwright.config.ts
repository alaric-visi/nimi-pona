import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (vite preview), so they cover
 * exactly what ships — including the service worker.
 */
const PORT = 4317;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 5_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
