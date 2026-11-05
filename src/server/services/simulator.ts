import { z } from "zod";
import { db } from "@/lib/db";
import { periodForDate, todayISO } from "@/lib/dates";
import { centsToNumber } from "@/lib/money";
import { simulatePurchase } from "@/features/simulator/calculations";
import { purchaseSimulationSchema } from "@/features/schemas";
import { categorySpend, consolidatedBalance, plannedNet } from "@/server/repositories/ledger";
import { getAccessibleCategory } from "@/server/repositories/ownership";
import { listGoals } from "./goals";

export async function runPurchaseSimulation(
  userId: string,
  input: z.infer<typeof purchaseSimulationSchema>,
) {
  const [category, user, ledger, goals] = await Promise.all([
    getAccessibleCategory(db, userId, input.categoryId),
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { financialMonthStartDay: true, minReserveCents: true },
    }),
    consolidatedBalance(db, userId),
    listGoals(userId, { onlyActive: true }),
  ]);

  const period = periodForDate(input.plannedDate, user.financialMonthStartDay);
  const [spend, budget, planned] = await Promise.all([
    categorySpend(db, userId, { ...period, categoryId: input.categoryId }),
    db.budget.findUnique({
      where: {
        userId_categoryId_year_month: {
          userId,
          categoryId: input.categoryId,
          year: period.year,
          month: period.month,
        },
      },
    }),
    plannedNet(db, userId, todayISO(), input.plannedDate),
  ]);

  return simulatePurchase(
    { amountCents: input.amountCents, essential: input.essential },
    {
      hasAccounts: ledger.hasAccounts,
      availableCents: ledger.balanceCents,
      // Previstos líquidos negativos são saída; positivos reduzem a saída projetada.
      plannedOutflowCents: -planned,
      minReserveCents: user.minReserveCents === null ? null : centsToNumber(user.minReserveCents),
      categoryName: category.name,
      budget: budget
        ? {
            limitCents: centsToNumber(budget.limitCents),
            spentCents: Math.max(spend.get(input.categoryId) ?? 0, 0),
          }
        : null,
      goals: goals
        .filter((goal) => goal.remainingCents > 0)
        .slice(0, 3)
        .map((goal) => ({
          title: goal.title,
          remainingCents: goal.remainingCents,
          requiredMonthlyCents: goal.requiredMonthlyCents,
        })),
    },
  );
}
