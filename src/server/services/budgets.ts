import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type DbClient } from "@/lib/db";
import { financialPeriod, periodForDate, todayISO } from "@/lib/dates";
import { AppError, notFound, validationError } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import {
  alertMessage,
  budgetProgress,
  crossedAlertLevels,
  highestAlertLevel,
  type BudgetAlertLevel,
} from "@/features/budgets/calculations";
import { createBudgetSchema, updateBudgetSchema } from "@/features/schemas";
import { categorySpend } from "@/server/repositories/ledger";
import { getAccessibleCategory } from "@/server/repositories/ownership";
import { audit } from "./audit";

export interface BudgetDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  year: number;
  month: number;
  limitCents: number;
  spentCents: number;
  percent: number;
  level: BudgetAlertLevel | null;
}

async function startDayOf(client: DbClient, userId: string): Promise<number> {
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { financialMonthStartDay: true },
  });
  return user.financialMonthStartDay;
}

export async function listBudgets(userId: string, year: number, month: number): Promise<BudgetDTO[]> {
  const startDay = await startDayOf(db, userId);
  const period = financialPeriod(year, month, startDay);
  const [budgets, spend] = await Promise.all([
    db.budget.findMany({
      where: { userId, year, month },
      include: { category: { select: { name: true, color: true } } },
      orderBy: { category: { name: "asc" } },
    }),
    categorySpend(db, userId, period),
  ]);
  return budgets.map((budget) => {
    const limitCents = centsToNumber(budget.limitCents);
    const spentCents = Math.max(spend.get(budget.categoryId) ?? 0, 0);
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryColor: budget.category.color,
      year: budget.year,
      month: budget.month,
      limitCents,
      spentCents,
      percent: budgetProgress(spentCents, limitCents),
      level: highestAlertLevel(spentCents, limitCents),
    };
  });
}

/**
 * Grava as faixas atingidas. A restrição única (orçamento + faixa) impede repetição;
 * orçamentos são por mês, então cada faixa dispara uma vez por mês e categoria.
 */
export async function syncBudgetAlerts(
  client: DbClient,
  userId: string,
  categoryId: string | null,
  date: string,
): Promise<void> {
  if (!categoryId) return;
  const startDay = await startDayOf(client, userId);
  const period = periodForDate(date, startDay);
  const budget = await client.budget.findUnique({
    where: {
      userId_categoryId_year_month: { userId, categoryId, year: period.year, month: period.month },
    },
  });
  if (!budget) return;
  const spend = await categorySpend(client, userId, { ...period, categoryId });
  const levels = crossedAlertLevels(
    Math.max(spend.get(categoryId) ?? 0, 0),
    centsToNumber(budget.limitCents),
  );
  if (levels.length === 0) return;
  await client.budgetAlert.createMany({
    data: levels.map((level) => ({ userId, budgetId: budget.id, level })),
    skipDuplicates: true,
  });
}

export async function createBudget(
  userId: string,
  input: z.infer<typeof createBudgetSchema>,
): Promise<{ id: string }> {
  const category = await getAccessibleCategory(db, userId, input.categoryId);
  if (category.type !== "EXPENSE") {
    throw validationError("categoryId", "Orçamentos usam categorias de despesa.");
  }
  try {
    const budget = await db.budget.create({
      data: { ...input, userId, limitCents: BigInt(input.limitCents) },
    });
    const startDay = await startDayOf(db, userId);
    await syncBudgetAlerts(
      db,
      userId,
      input.categoryId,
      financialPeriod(input.year, input.month, startDay).from,
    );
    await audit(db, userId, "budget.create", "Budget", budget.id);
    return { id: budget.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("CONFLICT", "Já existe orçamento para esta categoria neste mês.", 409, {
        categoryId: ["Já existe orçamento para esta categoria neste mês."],
      });
    }
    throw error;
  }
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: z.infer<typeof updateBudgetSchema>,
): Promise<void> {
  const budget = await db.budget.findFirst({ where: { id: budgetId, userId } });
  if (!budget) throw notFound("Orçamento");
  const startDay = await startDayOf(db, userId);
  await db.$transaction(async (tx) => {
    await tx.budget.update({
      where: { id: budget.id },
      data: { limitCents: BigInt(input.limitCents) },
    });
    // Com novo limite, as faixas são reavaliadas do zero.
    await tx.budgetAlert.deleteMany({ where: { budgetId: budget.id } });
    await syncBudgetAlerts(
      tx,
      userId,
      budget.categoryId,
      financialPeriod(budget.year, budget.month, startDay).from,
    );
  });
  await audit(db, userId, "budget.update", "Budget", budgetId);
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const result = await db.budget.deleteMany({ where: { id: budgetId, userId } });
  if (result.count === 0) throw notFound("Orçamento");
  await audit(db, userId, "budget.delete", "Budget", budgetId);
}

export interface BudgetAlertDTO {
  id: string;
  level: BudgetAlertLevel;
  categoryName: string;
  percent: number;
  message: string;
}

/**
 * Alertas não lidos do período corrente. Exibe só a faixa mais alta ainda verdadeira por
 * orçamento, de modo que excluir um lançamento não deixa alerta desatualizado na tela.
 */
export async function listActiveAlerts(userId: string, now = new Date()): Promise<BudgetAlertDTO[]> {
  const startDay = await startDayOf(db, userId);
  const period = periodForDate(todayISO(now), startDay);
  const budgets = await listBudgets(userId, period.year, period.month);
  const alerts = await db.budgetAlert.findMany({
    where: { userId, readAt: null, budgetId: { in: budgets.map((budget) => budget.id) } },
  });
  return budgets.flatMap((budget) => {
    if (!budget.level) return [];
    const alert = alerts.find((item) => item.budgetId === budget.id && item.level === budget.level);
    if (!alert) return [];
    return [
      {
        id: alert.id,
        level: alert.level,
        categoryName: budget.categoryName,
        percent: budget.percent,
        message: alertMessage(alert.level, budget.categoryName, budget.percent),
      },
    ];
  });
}

export async function markAlertRead(userId: string, alertId: string): Promise<void> {
  const result = await db.budgetAlert.updateMany({
    where: { id: alertId, userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw notFound("Alerta");
}
