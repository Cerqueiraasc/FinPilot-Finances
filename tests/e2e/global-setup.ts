import { execSync } from "node:child_process";

export default function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ?? "postgresql://finpilot:finpilot@localhost:5432/finpilot_test",
  };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  execSync("npx prisma db seed", { stdio: "pipe", env });
  // Evita que execuções repetidas esbarrem nos limites de tentativas.
  execSync("npx tsx tests/e2e/reset-rate-limits.ts", { stdio: "pipe", env });
}
