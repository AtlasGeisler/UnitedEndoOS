import { defineConfig, devices } from "@playwright/test";

// Smoke tests for the phase checkpoint flows. They assume a seeded database, run
// `npm run db:push` and `npm run seed` first. The web server is reused if it is
// already running, otherwise Playwright starts it.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
