import { db } from "@/lib/db";
import { dateToISO, addDays, isoToDate, periodForDate, periodKey, shiftPeriod, todayISO } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import {
  ASSISTANT_DISCLAIMER,
  deterministicAnswer,
  minimizeMetrics,
  outputUsesOnlyKnownValues,
  type AssistantResponse,
} from "@/features/insights/assistant";
import {
  generateInsights,
  type DeterministicInsight,
  type InsightMetrics,
} from "@/features/insights/engine";
import { categorySpend, consolidatedBalance, plannedNet } from "@/server/repositories/ledger";
import { getAiProvider, type AiProvider } from "@/server/providers/ai";
import { listBudgets } from "./budgets";
import { hasActiveAiConsent } from "./consent";
import { listGoals } from "./goals";

const LOOKBACK_MONTHS = 6;

export async function buildMetrics(userId: string, now = new Date()): Promise<InsightMetrics> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { financialMonthStartDay: true },
  });
  const startDay = user.financialMonthStartDay;
  const today = todayISO(now);
  const period = periodForDate(today, startDay);
  const previous = shiftPeriod(period, -1, startDay);
  const lookback = shiftPeriod(period, -LOOKBACK_MONTHS, startDay);

  const [current, prior, categories, budgets, goals, expenses, ledger, planned] = await Promise.all([
    categorySpend(db, userId, period),
    categorySpend(db, userId, previous),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true },
    }),
    listBudgets(userId, period.year, period.month),
    listGoals(userId, { onlyActive: true }),
    db.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        status: "POSTED",
        transactionDate: { gte: isoToDate(lookback.from) },
      },
      select: {
        description: true,
        amountCents: true,
        transactionDate: true,
        recurrenceRuleId: true,
      },
    }),
    consolidatedBalance(db, userId),
    plannedNet(db, userId, today, addDays(today, 30)),
  ]);

  const categoryIds = new Set(
    [...current.keys(), ...prior.keys()].filter((id): id is string => id !== null),
  );
  return {
    period: periodKey(period),
    today,
    categorySpend: [...categoryIds].map((categoryId) => ({
      categoryId,
      name: categories.find((category) => category.id === categoryId)?.name ?? "Categoria",
      currentCents: Math.max(current.get(categoryId) ?? 0, 0),
      previousCents: Math.max(prior.get(categoryId) ?? 0, 0),
    })),
    budgets: budgets.map((budget) => ({
      categoryId: budget.categoryId,
      name: budget.categoryName,
      limitCents: budget.limitCents,
      spentCents: budget.spentCents,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      remainingCents: goal.remainingCents,
      dueDate: goal.dueDate,
      requiredMonthlyCents: goal.requiredMonthlyCents,
      averageMonthlyCents: goal.averageMonthlyCents,
    })),
    expenses: expenses.map((expense) => ({
      description: expense.description,
      amountCents: centsToNumber(expense.amountCents),
      date: dateToISO(expense.transactionDate),
      recurring: expense.recurrenceRuleId !== null,
    })),
    balanceCents: ledger.balanceCents,
    plannedNetNext30DaysCents: planned,
    hasAccounts: ledger.hasAccounts,
  };
}

/** Recalcula, deduplica pela chave e remove insights que deixaram de ser verdadeiros. */
export async function refreshInsights(
  userId: string,
  now = new Date(),
): Promise<{ metrics: InsightMetrics; insights: DeterministicInsight[] }> {
  const metrics = await buildMetrics(userId, now);
  const insights = generateInsights(metrics);
  await db.$transaction(async (tx) => {
    await tx.insight.deleteMany({
      where: { userId, dedupeKey: { notIn: insights.map((insight) => insight.dedupeKey) } },
    });
    for (const insight of insights) {
      const payload = {
        severity: insight.severity,
        title: insight.title,
        summary: insight.summary,
        evidence: insight.evidence,
        suggestedActions: insight.suggestedActions,
      };
      await tx.insight.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: insight.dedupeKey } },
        create: {
          userId,
          dedupeKey: insight.dedupeKey,
          type: insight.type,
          period: metrics.period,
          payload,
        },
        update: { payload },
      });
    }
  });
  return { metrics, insights };
}

export async function listInsights(userId: string) {
  const { insights } = await refreshInsights(userId);
  return insights;
}

/**
 * A IA só roda com preferência ativa, consentimento registrado e chave configurada. Saída
 * inválida, indisponibilidade ou valor desconhecido caem no fallback determinístico.
 */
export async function explainForUser(
  userId: string,
  question: string | undefined,
  provider: AiProvider | null = getAiProvider(),
): Promise<AssistantResponse & { aiAvailable: boolean }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { aiEnabled: true } });
  if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);

  const { metrics, insights } = await refreshInsights(userId);
  const deterministic = {
    ...deterministicAnswer(question, metrics, insights),
    source: "deterministic" as const,
    aiAvailable: provider !== null,
  };
  if (!provider || !user.aiEnabled || !(await hasActiveAiConsent(userId))) return deterministic;

  const defaults = await db.category.findMany({ where: { userId: null }, select: { id: true } });
  const minimized = minimizeMetrics(metrics, insights, new Set(defaults.map((item) => item.id)));
  const output = await provider.explain(minimized, question);
  if (!output || !outputUsesOnlyKnownValues(output, minimized)) return deterministic;
  return {
    ...output,
    disclaimer: output.disclaimer || ASSISTANT_DISCLAIMER,
    source: "ai",
    aiAvailable: true,
  };
}
