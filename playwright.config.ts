import { defineConfig, devices } from "@playwright/test";

/** Os E2E usam o banco de teste; os dados de desenvolvimento ficam intactos. */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://finpilot:finpilot@localhost:5432/finpilot_test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL,
      APP_URL: "http://localhost:3100",
      DEMO_MODE_ENABLED: "true",
      EMAIL_PROVIDER: "memory",
    },
  },
});
