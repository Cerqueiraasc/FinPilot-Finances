import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, "src") };
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://finpilot:finpilot@localhost:5432/finpilot_test";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["tests/unit/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          env: { DATABASE_URL: TEST_DATABASE_URL, EMAIL_PROVIDER: "memory", DEMO_MODE_ENABLED: "true" },
          globalSetup: ["tests/integration/global-setup.ts"],
          // Os testes compartilham um único banco.
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
    ],
  },
});
