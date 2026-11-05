import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, dateToISO, isoToDate, todayISO } from "@/lib/dates";
import { notFound, validationError } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import {
  nextOccurrenceAfter,
  occurrencesBetween,
  type Cadence,
} from "@/features/recurrences/calculations";
import { createRecurrenceSchema, updateRecurrenceSchema } from "@/features/schemas";
import {
  assertCategoryCompatible,
  getAccessibleCategory,
  getOwnedAccount,
} from "@/server/repositories/ownership";
import { audit } from "./audit";
import { syncBudgetAlerts } from "./budgets";

const PLANNING_HORIZON_DAYS = 60;

export async function listRecurrences(userId: string) {
  const rules = await db.recurrenceRule.findMany({
    where: { userId },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
  });
  return rules.map((rule) => ({
    id: rule.id,
    accountName: rule.account.name,
    categoryName: rule.category?.name ?? null,
    type: rule.type,
    amountCents: centsToNumber(rule.amountCents),
    description: rule.description,
    cadence: rule.cadence,
    startDate: dateToISO(rule.startDate),
    endDate: rule.endDate ? dateToISO(rule.endDate) : null,
    nextRunAt: dateToISO(rule.nextRunAt),
    active: rule.active,
  }));
}

export async function createRecurrence(
  userId: string,
  input: z.infer<typeof createRecurrenceSchema>,
): Promise<{ id: string }> {
  await getOwnedAccount(db, userId, input.accountId);
  if (input.categoryId) {
    assertCategoryCompatible(await getAccessibleCategory(db, userId, input.categoryId), input.type);
  }
  if (input.endDate && input.endDate < input.startDate) {
    throw validationError("endDate", "O fim da série deve ser depois do início.");
  }
  const rule = await db.recurrenceRule.create({
    data: {
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amountCents: BigInt(input.amountCents),
      description: input.description,
      notes: input.notes ?? null,
      tags: input.tags,
      cadence: input.cadence,
      startDate: isoToDate(input.startDate),
      endDate: input.endDate ? isoToDate(input.endDate) : null,
      nextRunAt: isoToDate(input.startDate),
    },
  });
  await audit(db, userId, "recurrence.create", "RecurrenceRule", rule.id);
  await materializeRecurrences(userId);
  return { id: rule.id };
}

/**
 * Edita a série: ocorrências futuras e não personalizadas acompanham a mudança.
 * Ocorrências passadas e as editadas individualmente ficam como estão.
 */
export async function updateRecurrence(
  userId: string,
  ruleId: string,
  input: z.infer<typeof updateRecurrenceSchema>,
): Promise<void> {
  const rule = await db.recurrenceRule.findFirst({ where: { id: ruleId, userId } });
  if (!rule) throw notFound("Recorrência");
  const nextCategoryId = input.categoryId === undefined ? rule.categoryId : input.categoryId;
  if (nextCategoryId) {
    assertCategoryCompatible(
      await getAccessibleCategory(db, userId, nextCategoryId),
      rule.type as "INCOME" | "EXPENSE",
    );
  }
  const today = todayISO();
  await db.$transaction(async (tx) => {
    await tx.recurrenceRule.update({
      where: { id: ruleId },
      data: {
        ...(input.amountCents !== undefined ? { amountCents: BigInt(input.amountCents) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ? isoToDate(input.endDate) : null }
          : {}),
        categoryId: nextCategoryId,
      },
    });
    const future = {
      userId,
      recurrenceRuleId: ruleId,
      status: "PENDING" as const,
      isOccurrenceOverride: false,
      transactionDate: { gt: isoToDate(today) },
    };
    if (input.active === false) {
      await tx.transaction.updateMany({ where: future, data: { status: "CANCELED" } });
    } else {
      await tx.transaction.updateMany({
        where: future,
        data: {
          ...(input.amountCents !== undefined ? { amountCents: BigInt(input.amountCents) } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          categoryId: nextCategoryId,
        },
      });
    }
    if (input.endDate) {
      await tx.transaction.updateMany({
        where: { ...future, transactionDate: { gt: isoToDate(input.endDate) } },
        data: { status: "CANCELED" },
      });
    }
    await audit(tx, userId, "recurrence.update", "RecurrenceRule", ruleId);
  });
}

/** Remove a regra; lançamentos já gerados continuam no histórico, os futuros são cancelados. */
export async function deleteRecurrence(userId: string, ruleId: string): Promise<void> {
  const today = todayISO();
  await db.$transaction(async (tx) => {
    const rule = await tx.recurrenceRule.findFirst({ where: { id: ruleId, userId } });
    if (!rule) throw notFound("Recorrência");
    await tx.transaction.updateMany({
      where: {
        userId,
        recurrenceRuleId: ruleId,
        status: "PENDING",
        transactionDate: { gt: isoToDate(today) },
      },
      data: { status: "CANCELED" },
    });
    await tx.recurrenceRule.delete({ where: { id: ruleId } });
    await audit(tx, userId, "recurrence.delete", "RecurrenceRule", ruleId);
  });
}

/**
 * Gera ocorrências até o horizonte de planejamento. É idempotente: a restrição única
 * (regra + data) e o skipDuplicates impedem duplicidade, mesmo em execuções concorrentes.
 */
export async function materializeRecurrences(userId: string, now = new Date()): Promise<number> {
  const today = todayISO(now);
  const horizon = addDays(today, PLANNING_HORIZON_DAYS);
  const rules = await db.recurrenceRule.findMany({
    where: { userId, active: true, nextRunAt: { lte: isoToDate(horizon) } },
  });
  let created = 0;

  for (const rule of rules) {
    const startDate = dateToISO(rule.startDate);
    const endDate = rule.endDate ? dateToISO(rule.endDate) : null;
    const cadence = rule.cadence as Cadence;
    const dates = occurrencesBetween(
      startDate,
      cadence,
      dateToISO(rule.nextRunAt),
      horizon,
      endDate,
    );
    await db.$transaction(async (tx) => {
      const result = await tx.transaction.createMany({
        data: dates.map((date) => ({
          userId,
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          type: rule.type,
          amountCents: rule.amountCents,
          description: rule.description,
          notes: rule.notes,
          tags: rule.tags,
          transactionDate: isoToDate(date),
          occurrenceDate: isoToDate(date),
          status: date <= today ? ("POSTED" as const) : ("PENDING" as const),
          source: "RECURRENCE" as const,
          recurrenceRuleId: rule.id,
        })),
        skipDuplicates: true,
      });
      created += result.count;
      await tx.recurrenceRule.update({
        where: { id: rule.id },
        data: { nextRunAt: isoToDate(nextOccurrenceAfter(startDate, cadence, horizon)) },
      });
      for (const date of dates.filter((item) => item <= today)) {
        await syncBudgetAlerts(tx, userId, rule.categoryId, date);
      }
    });
  }

  // Ocorrências e transferências previstas cuja data chegou passam a efetivadas,
  // salvo ocorrências editadas à mão.
  const due = await db.transaction.findMany({
    where: {
      userId,
      status: "PENDING",
      transactionDate: { lte: isoToDate(today) },
      OR: [
        { recurrenceRuleId: { not: null }, isOccurrenceOverride: false },
        { transferId: { not: null } },
      ],
    },
    select: { id: true, categoryId: true, transactionDate: true },
  });
  for (const item of due) {
    await db.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id: item.id }, data: { status: "POSTED" } });
      await syncBudgetAlerts(tx, userId, item.categoryId, dateToISO(item.transactionDate));
    });
  }
  return created;
}

export async function materializeAllUsers(now = new Date()): Promise<number> {
  const users = await db.recurrenceRule.findMany({
    where: { active: true },
    distinct: ["userId"],
    select: { userId: true },
  });
  let created = 0;
  for (const { userId } of users) created += await materializeRecurrences(userId, now);
  return created;
}
