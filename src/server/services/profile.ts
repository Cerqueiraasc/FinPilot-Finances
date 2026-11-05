import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { verifyPassword } from "@/lib/security/password";
import { deleteAccountSchema, onboardingSchema, profileSchema } from "@/features/schemas";
import { audit } from "./audit";

const toBigIntOrNull = (value: number | null) => (value === null ? null : BigInt(value));

export async function updateProfile(
  userId: string,
  input: z.infer<typeof profileSchema>,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      financialMonthStartDay: input.financialMonthStartDay,
      estimatedIncomeCents: toBigIntOrNull(input.estimatedIncomeCents),
      minReserveCents: toBigIntOrNull(input.minReserveCents),
    },
  });
  await audit(db, userId, "user.update_profile", "User", userId);
}

export async function completeOnboarding(
  userId: string,
  input: z.infer<typeof onboardingSchema>,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        financialMonthStartDay: input.financialMonthStartDay,
        estimatedIncomeCents: toBigIntOrNull(input.estimatedIncomeCents),
        minReserveCents: toBigIntOrNull(input.minReserveCents),
        onboardedAt: new Date(),
      },
    });
    await tx.account.create({
      data: {
        userId,
        name: input.accountName,
        type: "CHECKING",
        openingBalanceCents: BigInt(input.openingBalanceCents),
      },
    });
    if (input.goalTitle && input.goalTargetCents) {
      await tx.goal.create({
        data: { userId, title: input.goalTitle, targetCents: BigInt(input.goalTargetCents) },
      });
    }
    await audit(tx, userId, "user.onboarding_complete", "User", userId);
  });
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item)),
  );
}

/** Exportação portável de todos os dados do usuário, sem segredos de autenticação. */
export async function exportUserData(userId: string): Promise<unknown> {
  const [
    profile,
    accounts,
    categories,
    transactions,
    transfers,
    budgets,
    goals,
    recurrences,
    rules,
    importBatches,
    insights,
    consents,
    auditEvents,
  ] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        emailVerifiedAt: true,
        locale: true,
        timezone: true,
        currency: true,
        financialMonthStartDay: true,
        estimatedIncomeCents: true,
        minReserveCents: true,
        aiEnabled: true,
        createdAt: true,
      },
    }),
    db.account.findMany({ where: { userId } }),
    db.category.findMany({ where: { userId } }),
    db.transaction.findMany({ where: { userId } }),
    db.transfer.findMany({ where: { userId } }),
    db.budget.findMany({ where: { userId } }),
    db.goal.findMany({ where: { userId }, include: { contributions: true } }),
    db.recurrenceRule.findMany({ where: { userId } }),
    db.categoryRule.findMany({ where: { userId } }),
    db.importBatch.findMany({ where: { userId } }),
    db.insight.findMany({ where: { userId } }),
    db.consent.findMany({ where: { userId } }),
    db.auditEvent.findMany({ where: { userId } }),
  ]);
  await audit(db, userId, "privacy.export", "User", userId);
  return serialize({
    exportedAt: new Date().toISOString(),
    format: "finpilot-export-v1",
    moneyUnit: "centavos",
    profile,
    accounts,
    categories,
    transactions,
    transfers,
    budgets,
    goals,
    recurrences,
    categoryRules: rules,
    importBatches,
    insights,
    consents,
    auditEvents,
  });
}

/** Exclusão imediata e definitiva: as chaves estrangeiras removem todos os dados em cascata. */
export async function deleteUserAccount(
  userId: string,
  input: z.infer<typeof deleteAccountSchema>,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isDemo) {
    throw new AppError("DEMO_READONLY", "A conta de demonstração não pode ser excluída.", 403);
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError("INVALID_CREDENTIALS", "Senha incorreta.", 400, {
      password: ["Senha incorreta."],
    });
  }
  await db.user.delete({ where: { id: userId } });
}
