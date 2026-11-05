import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/server/services/categories";

let counter = 0;

export async function resetDatabase(): Promise<void> {
  await db.user.deleteMany();
  await db.rateLimitBucket.deleteMany();
  await ensureDefaultCategories();
}

export async function createUser(overrides: { startDay?: number; name?: string } = {}) {
  counter += 1;
  return db.user.create({
    data: {
      name: overrides.name ?? `Teste ${counter}`,
      email: `teste${counter}-${Date.now()}@example.test`,
      passwordHash: "x",
      financialMonthStartDay: overrides.startDay ?? 1,
      onboardedAt: new Date(),
    },
  });
}

export async function createAccount(userId: string, openingBalanceCents = 0, name = "Conta") {
  return db.account.create({
    data: { userId, name, type: "CHECKING", openingBalanceCents: BigInt(openingBalanceCents) },
  });
}
