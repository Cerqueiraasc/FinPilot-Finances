import "dotenv/config";
import { db } from "@/lib/db";
import { materializeAllUsers } from "@/server/services/recurrences";

/** Execução agendada: `npm run job:recurrences` (também roda ao abrir o app). */
async function main() {
  const created = await materializeAllUsers();
  console.info(JSON.stringify({ event: "job.recurrences", created }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: "job.recurrences.failed", errorName: error?.name }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
