import { db } from "@/lib/db";
import {
  addDays,
  isoToDate,
  periodForDate,
  periodKey,
  shiftPeriod,
  shortMonthLabel,
  todayISO,
  type FinancialPeriod,
} from "@/lib/dates";
import { centsToNumber } from "@/lib/money";
import {
  categorySpend,
  consolidatedBalance,
  periodSummary,
  plannedNet,
} from "@/server/repositories/ledger";
import { balanceEffect, type LedgerType, type PeriodSummary } from "@/features/transactions/calculations";
import { listAccounts } from "./accounts";
import { listActiveAlerts, listBudgets, type BudgetAlertDTO, type BudgetDTO } from "./budgets";
import { listGoals, type GoalDTO } from "./goals";

export interface MonthlyPoint {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  /** Saldo consolidado ao final do período (até hoje no período corrente). */
  balanceCents: number;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  amountCents: number;
}

export interface DashboardData {
  period: FinancialPeriod;
  periodIsPartial: boolean;
  hasData: boolean;
  hasAccounts: boolean;
  balanceCents: number;
  plannedNet30DaysCents: number;
  summary: PeriodSummary;
  previousSummary: PeriodSummary;
  series: MonthlyPoint[];
  categories: CategorySlice[];
  budgets: BudgetDTO[];
  goals: GoalDTO[];
  alerts: BudgetAlertDTO[];
}

async function monthlySeries(
  userId: string,
  current: FinancialPeriod,
  startDay: number,
  months: number,
): Promise<MonthlyPoint[]> {
  const periods = Array.from({ length: months }, (_, index) =>
    shiftPeriod(current, index - months + 1, startDay),
  );
  const first = periods[0];
  const rows = await db.transaction.groupBy({
    by: ["transactionDate", "type"],
    where: {
      userId,
      status: "POSTED",
      transactionDate: { lt: isoToDate(current.toExclusive) },
    },
    _sum: { amountCents: true },
  });
  const accounts = await db.account.findMany({
    where: { userId },
    select: { openingBalanceCents: true },
  });
  const opening = accounts.reduce(
    (sum, account) => sum + centsToNumber(account.openingBalanceCents),
    0,
  );

  const points = periods.map((period) => ({
    key: periodKey(period),
    label: shortMonthLabel(period.year, period.month),
    incomeCents: 0,
    expenseCents: 0,
    balanceCents: 0,
    period,
  }));

  let carried = opening;
  const sorted = [...rows].sort(
    (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime(),
  );
  const firstDate = isoToDate(first.from).getTime();
  for (const row of sorted) {
    const amount = centsToNumber(row._sum.amountCents ?? BigInt(0));
    const type = row.type as LedgerType;
    if (row.transactionDate.getTime() < firstDate) {
      carried += balanceEffect(type, amount);
      continue;
    }
    const iso = row.transactionDate.toISOString().slice(0, 10);
    const point = points.find(
      (item) => iso >= item.period.from && iso < item.period.toExclusive,
    );
    if (!point) continue;
    if (type === "INCOME") point.incomeCents += amount;
    if (type === "EXPENSE") point.expenseCents += amount;
    if (type === "REFUND") point.expenseCents -= amount;
    point.balanceCents += balanceEffect(type, amount);
  }
  return points.map((point) => {
    carried += point.balanceCents;
    return {
      key: point.key,
      label: point.label,
      incomeCents: point.incomeCents,
      expenseCents: point.expenseCents,
      balanceCents: carried,
    };
  });
}

export async function categorySlices(
  userId: string,
  filter: { from: string; toExclusive: string; accountId?: string; categoryId?: string },
): Promise<CategorySlice[]> {
  const [spend, categories] = await Promise.all([
    categorySpend(db, userId, filter),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true, color: true },
    }),
  ]);
  return [...spend.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([categoryId, amountCents]) => {
      const category = categories.find((item) => item.id === categoryId);
      return {
        categoryId,
        name: category?.name ?? "Sem categoria",
        color: category?.color ?? null,
        amountCents,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);
}

export async function getDashboard(
  userId: string,
  startDay: number,
  now = new Date(),
): Promise<DashboardData> {
  const today = todayISO(now);
  const period = periodForDate(today, startDay);
  const previous = shiftPeriod(period, -1, startDay);
  const [ledger, summary, previousSummary, series, categories, budgets, goals, alerts, accounts, count, planned] =
    await Promise.all([
      consolidatedBalance(db, userId),
      periodSummary(db, userId, period),
      periodSummary(db, userId, previous),
      monthlySeries(userId, period, startDay, 6),
      categorySlices(userId, period),
      listBudgets(userId, period.year, period.month),
      listGoals(userId, { onlyActive: true }),
      listActiveAlerts(userId, now),
      listAccounts(userId),
      db.transaction.count({ where: { userId } }),
      plannedNet(db, userId, today, addDays(today, 30)),
    ]);
  return {
    period,
    periodIsPartial: today < addDays(period.toExclusive, -1),
    hasData: count > 0,
    hasAccounts: accounts.length > 0,
    balanceCents: ledger.balanceCents,
    plannedNet30DaysCents: planned,
    summary,
    previousSummary,
    series,
    categories,
    budgets,
    goals,
    alerts,
  };
}
