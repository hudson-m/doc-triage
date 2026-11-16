import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Same shape as production: the API serves the built UI from one process (and one container).
  webServer: {
    command: "npm run build && node apps/api/src/server.ts",
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), LLM_PROVIDER: "fake", WEB_DIST: "apps/web/dist" },
    timeout: 120_000,
  },
});
