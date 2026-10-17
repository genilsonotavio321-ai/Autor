import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Suite offline: exige um build de produção (o service worker do Serwist
 * fica desativado em desenvolvimento). O `webServer` builda e sobe o app.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "offline/**/*.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    locale: "pt-BR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
