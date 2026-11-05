import { formatBRL } from "@/lib/money";

export interface PurchaseInput {
  amountCents: number;
  essential: boolean;
}

export interface PurchaseContext {
  hasAccounts: boolean;
  /** Saldo realizado somado das contas ativas. */
  availableCents: number;
  /** Despesas pendentes líquidas de entradas pendentes até a data planejada. */
  plannedOutflowCents: number;
  minReserveCents: number | null;
  categoryName: string;
  budget: { limitCents: number; spentCents: number } | null;
  goals: { title: string; remainingCents: number; requiredMonthlyCents: number | null }[];
}

export type SimulationOutcome =
  | { sufficient: false; reason: string }
  | {
      sufficient: true;
      projectedBalanceCents: number;
      marginCents: number;
      budgetImpact: { percentBefore: number; percentAfter: number; remainingCents: number } | null;
      goalImpacts: { title: string; message: string }[];
      explanation: string[];
      assumptions: string[];
    };

/**
 * margem = saldo disponível - despesas previstas até a data - reserva mínima - valor da compra.
 * O resultado descreve o cenário: não autoriza, não bloqueia e não garante solvência.
 */
export function simulatePurchase(input: PurchaseInput, context: PurchaseContext): SimulationOutcome {
  if (!context.hasAccounts) {
    return {
      sufficient: false,
      reason: "Informação insuficiente: cadastre ao menos uma conta para simular o impacto da compra.",
    };
  }

  const reserve = context.minReserveCents ?? 0;
  const projectedBalanceCents =
    context.availableCents - context.plannedOutflowCents - input.amountCents;
  const marginCents = projectedBalanceCents - reserve;

  const budgetImpact = context.budget
    ? {
        percentBefore: Math.floor((context.budget.spentCents * 100) / context.budget.limitCents),
        percentAfter: Math.floor(
          ((context.budget.spentCents + input.amountCents) * 100) / context.budget.limitCents,
        ),
        remainingCents: context.budget.limitCents - context.budget.spentCents - input.amountCents,
      }
    : null;

  const explanation = [
    `Depois da compra e das despesas previstas, o saldo projetado fica em ${formatBRL(projectedBalanceCents)}.`,
  ];
  if (context.minReserveCents !== null) {
    explanation.push(
      marginCents >= 0
        ? `Sobram ${formatBRL(marginCents)} acima da reserva mínima de ${formatBRL(reserve)}.`
        : `Faltam ${formatBRL(-marginCents)} para manter a reserva mínima de ${formatBRL(reserve)}.`,
    );
  } else {
    explanation.push("Você não definiu uma reserva mínima, então a margem não considera nenhuma reserva.");
  }
  if (budgetImpact) {
    explanation.push(
      `O orçamento de ${context.categoryName} iria de ${budgetImpact.percentBefore}% para ${budgetImpact.percentAfter}% do limite.`,
    );
  } else {
    explanation.push(`Não há orçamento de ${context.categoryName} neste mês para comparar.`);
  }
  explanation.push(
    input.essential
      ? "Você marcou esta compra como essencial."
      : "Você marcou esta compra como opcional; adiar é uma das possibilidades a comparar.",
  );

  const goalImpacts = context.goals.map((goal) => ({
    title: goal.title,
    message:
      goal.requiredMonthlyCents === null
        ? `Faltam ${formatBRL(goal.remainingCents)}. A compra equivale a ${percentOf(input.amountCents, goal.remainingCents)}% desse valor.`
        : `Faltam ${formatBRL(goal.remainingCents)}, cerca de ${formatBRL(goal.requiredMonthlyCents)} por mês até o prazo. A compra equivale a ${percentOf(input.amountCents, goal.remainingCents)}% do que falta.`,
  }));

  return {
    sufficient: true,
    projectedBalanceCents,
    marginCents,
    budgetImpact,
    goalImpacts,
    explanation,
    assumptions: [
      "Compra à vista, considerada na data planejada.",
      "Considera apenas lançamentos registrados aqui; gastos não registrados ficam de fora.",
      "É uma estimativa para apoiar sua decisão, sem garantia de que o saldo se confirmará.",
    ],
  };
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part * 100) / whole) : 0;
}
