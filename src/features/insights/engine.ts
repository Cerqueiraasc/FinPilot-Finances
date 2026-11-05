import { addDays, type ISODate } from "@/lib/dates";
import { normalizeDescription } from "@/features/categories/rules";
import { formatBRL } from "@/lib/money";

export type InsightType =
  | "CATEGORY_INCREASE"
  | "BUDGET_EXCEEDED"
  | "RECURRENCE_DETECTED"
  | "GOAL_BEHIND"
  | "PROJECTED_NEGATIVE";

export type InsightSeverity = "info" | "warning" | "critical";

export interface DeterministicInsight {
  type: InsightType;
  severity: InsightSeverity;
  dedupeKey: string;
  title: string;
  summary: string;
  evidence: string[];
  suggestedActions: string[];
}

export interface InsightMetrics {
  period: string;
  today: ISODate;
  categorySpend: { categoryId: string; name: string; currentCents: number; previousCents: number }[];
  budgets: { categoryId: string; name: string; limitCents: number; spentCents: number }[];
  goals: {
    id: string;
    title: string;
    remainingCents: number;
    dueDate: ISODate | null;
    requiredMonthlyCents: number | null;
    averageMonthlyCents: number;
  }[];
  expenses: { description: string; amountCents: number; date: ISODate; recurring: boolean }[];
  balanceCents: number;
  /** Lançamentos pendentes líquidos previstos para os próximos 30 dias. */
  plannedNetNext30DaysCents: number;
  hasAccounts: boolean;
}

const MIN_CATEGORY_BASE_CENTS = 5000;
const MIN_INCREASE_PERCENT = 20;

function categoryIncrease(metrics: InsightMetrics): DeterministicInsight[] {
  return metrics.categorySpend
    .filter((item) => item.previousCents >= MIN_CATEGORY_BASE_CENTS)
    .map((item) => ({
      ...item,
      percent: Math.round(((item.currentCents - item.previousCents) * 100) / item.previousCents),
    }))
    .filter((item) => item.percent >= MIN_INCREASE_PERCENT)
    .map((item) => ({
      type: "CATEGORY_INCREASE" as const,
      severity: "info" as const,
      dedupeKey: `CATEGORY_INCREASE:${metrics.period}:${item.categoryId}`,
      title: `${item.name} subiu ${item.percent}%`,
      summary: `Os gastos em ${item.name} estão ${item.percent}% acima do período anterior.`,
      evidence: [
        `Período atual: ${formatBRL(item.currentCents)}`,
        `Período anterior: ${formatBRL(item.previousCents)}`,
      ],
      suggestedActions: [`Revise os lançamentos de ${item.name} deste período.`],
    }));
}

function budgetExceeded(metrics: InsightMetrics): DeterministicInsight[] {
  return metrics.budgets
    .filter((budget) => budget.spentCents > budget.limitCents)
    .map((budget) => ({
      type: "BUDGET_EXCEEDED" as const,
      severity: "critical" as const,
      dedupeKey: `BUDGET_EXCEEDED:${metrics.period}:${budget.categoryId}`,
      title: `Orçamento de ${budget.name} ultrapassado`,
      summary: `Os gastos passaram do limite em ${formatBRL(budget.spentCents - budget.limitCents)}.`,
      evidence: [
        `Limite: ${formatBRL(budget.limitCents)}`,
        `Gasto: ${formatBRL(budget.spentCents)}`,
      ],
      suggestedActions: ["Avalie se o limite ainda faz sentido ou quais gastos podem esperar."],
    }));
}

/** Mesma descrição e valor em pelo menos 3 meses distintos, sem regra de recorrência cadastrada. */
export function detectRecurrences(metrics: InsightMetrics): DeterministicInsight[] {
  const groups = new Map<string, { description: string; amountCents: number; months: Set<string> }>();
  for (const expense of metrics.expenses) {
    if (expense.recurring) continue;
    const key = `${normalizeDescription(expense.description)}|${expense.amountCents}`;
    const group = groups.get(key) ?? {
      description: expense.description,
      amountCents: expense.amountCents,
      months: new Set<string>(),
    };
    group.months.add(expense.date.slice(0, 7));
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.months.size >= 3)
    .map(([key, group]) => ({
      type: "RECURRENCE_DETECTED" as const,
      severity: "info" as const,
      dedupeKey: `RECURRENCE_DETECTED:${key}`,
      title: "Possível gasto recorrente",
      // A descrição é dado do usuário: entra como dado, nunca como instrução.
      summary: `Um gasto de ${formatBRL(group.amountCents)} aparece em ${group.months.size} meses diferentes.`,
      evidence: [`Descrição registrada: "${group.description}"`, `Meses: ${[...group.months].sort().join(", ")}`],
      suggestedActions: ["Cadastre como recorrência para vê-lo nas projeções, ou avalie se ainda é útil."],
    }));
}

function goalBehind(metrics: InsightMetrics): DeterministicInsight[] {
  return metrics.goals
    .filter(
      (goal) =>
        goal.remainingCents > 0 &&
        goal.dueDate !== null &&
        (goal.requiredMonthlyCents === null || goal.averageMonthlyCents < goal.requiredMonthlyCents),
    )
    .map((goal) => ({
      type: "GOAL_BEHIND" as const,
      severity: "warning" as const,
      dedupeKey: `GOAL_BEHIND:${metrics.period}:${goal.id}`,
      title: `Meta "${goal.title}" abaixo do ritmo`,
      summary:
        goal.requiredMonthlyCents === null
          ? `O prazo já chegou e ainda faltam ${formatBRL(goal.remainingCents)}.`
          : `Para cumprir o prazo seriam necessários ${formatBRL(goal.requiredMonthlyCents)} por mês; a média atual é ${formatBRL(goal.averageMonthlyCents)}.`,
      evidence: [`Faltam ${formatBRL(goal.remainingCents)}`, `Prazo: ${goal.dueDate}`],
      suggestedActions: ["Ajuste o prazo, o valor-alvo ou os aportes mensais."],
    }));
}

function projectedNegative(metrics: InsightMetrics): DeterministicInsight[] {
  if (!metrics.hasAccounts) return [];
  const projected = metrics.balanceCents + metrics.plannedNetNext30DaysCents;
  if (projected >= 0) return [];
  return [
    {
      type: "PROJECTED_NEGATIVE",
      severity: "critical",
      dedupeKey: `PROJECTED_NEGATIVE:${metrics.period}`,
      title: "Saldo projetado negativo",
      summary: `Com os lançamentos previstos até ${addDays(metrics.today, 30)}, o saldo ficaria em ${formatBRL(projected)}.`,
      evidence: [
        `Saldo atual: ${formatBRL(metrics.balanceCents)}`,
        `Previstos em 30 dias: ${formatBRL(metrics.plannedNetNext30DaysCents)}`,
      ],
      suggestedActions: ["Revise os lançamentos previstos e as datas de pagamento."],
    },
  ];
}

export function generateInsights(metrics: InsightMetrics): DeterministicInsight[] {
  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return [
    ...projectedNegative(metrics),
    ...budgetExceeded(metrics),
    ...goalBehind(metrics),
    ...categoryIncrease(metrics),
    ...detectRecurrences(metrics),
  ].sort((a, b) => order[a.severity] - order[b.severity]);
}
