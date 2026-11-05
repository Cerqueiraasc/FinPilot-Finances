import { db } from "../../src/lib/db";

db.rateLimitBucket
  .deleteMany()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
