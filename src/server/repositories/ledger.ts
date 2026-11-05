import type { DbClient } from "@/lib/db";
import { isoToDate } from "@/lib/dates";
import { centsToNumber } from "@/lib/money";
import type { LedgerEntry, LedgerType } from "@/features/transactions/calculations";
import { balanceEffect, summarizePeriod, type PeriodSummary } from "@/features/transactions/calculations";

/** Soma por tipo em SQL, sem carregar lançamentos em memória. */
export async function postedTotalsByAccount(client: DbClient, userId: string) {
  const rows = await client.transaction.groupBy({
    by: ["accountId", "type"],
    where: { userId, status: "POSTED" },
    _sum: { amountCents: true },
  });
  const totals = new Map<string, number>();
  for (const row of rows) {
    const amount = centsToNumber(row._sum.amountCents ?? BigInt(0));
    totals.set(
      row.accountId,
      (totals.get(row.accountId) ?? 0) + balanceEffect(row.type as LedgerType, amount),
    );
  }
  return totals;
}

export async function consolidatedBalance(
  client: DbClient,
  userId: string,
): Promise<{ balanceCents: number; hasAccounts: boolean }> {
  const accounts = await client.account.findMany({
    where: { userId },
    select: { id: true, openingBalanceCents: true, archivedAt: true },
  });
  const totals = await postedTotalsByAccount(client, userId);
  const balanceCents = accounts.reduce(
    (sum, account) =>
      sum + centsToNumber(account.openingBalanceCents) + (totals.get(account.id) ?? 0),
    0,
  );
  return { balanceCents, hasAccounts: accounts.length > 0 };
}

export interface PeriodFilter {
  from: string;
  toExclusive: string;
  accountId?: string;
  categoryId?: string;
}

function periodWhere(userId: string, filter: PeriodFilter) {
  return {
    userId,
    transactionDate: { gte: isoToDate(filter.from), lt: isoToDate(filter.toExclusive) },
    ...(filter.accountId ? { accountId: filter.accountId } : {}),
    ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
  };
}

export async function periodSummary(
  client: DbClient,
  userId: string,
  filter: PeriodFilter,
): Promise<PeriodSummary> {
  const rows = await client.transaction.groupBy({
    by: ["type"],
    where: { ...periodWhere(userId, filter), status: "POSTED" },
    _sum: { amountCents: true },
  });
  const entries: LedgerEntry[] = rows.map((row) => ({
    type: row.type as LedgerType,
    status: "POSTED",
    amountCents: centsToNumber(row._sum.amountCents ?? BigInt(0)),
  }));
  return summarizePeriod(entries);
}

/** Despesa líquida de estornos por categoria no período. */
export async function categorySpend(
  client: DbClient,
  userId: string,
  filter: PeriodFilter,
): Promise<Map<string | null, number>> {
  const rows = await client.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      ...periodWhere(userId, filter),
      status: "POSTED",
      type: { in: ["EXPENSE", "REFUND"] },
    },
    _sum: { amountCents: true },
  });
  const spend = new Map<string | null, number>();
  for (const row of rows) {
    const amount = centsToNumber(row._sum.amountCents ?? BigInt(0));
    spend.set(
      row.categoryId,
      (spend.get(row.categoryId) ?? 0) + (row.type === "EXPENSE" ? amount : -amount),
    );
  }
  return spend;
}

/** Efeito líquido dos pendentes em (de, até]; transferências entre contas se anulam. */
export async function plannedNet(
  client: DbClient,
  userId: string,
  fromExclusive: string,
  toInclusive: string,
  includeOverdue = true,
): Promise<number> {
  const rows = await client.transaction.groupBy({
    by: ["type"],
    where: {
      userId,
      status: "PENDING",
      transactionDate: {
        ...(includeOverdue ? {} : { gt: isoToDate(fromExclusive) }),
        lte: isoToDate(toInclusive),
      },
    },
    _sum: { amountCents: true },
  });
  return rows.reduce(
    (sum, row) =>
      sum + balanceEffect(row.type as LedgerType, centsToNumber(row._sum.amountCents ?? BigInt(0))),
    0,
  );
}
