export type LedgerType = "INCOME" | "EXPENSE" | "REFUND" | "TRANSFER_OUT" | "TRANSFER_IN";
export type LedgerStatus = "PENDING" | "POSTED" | "CANCELED";

export interface LedgerEntry {
  type: LedgerType;
  status: LedgerStatus;
  amountCents: number;
}

/** Efeito do lançamento no saldo da conta: positivo aumenta, negativo reduz. */
export function balanceEffect(type: LedgerType, amountCents: number): number {
  switch (type) {
    case "INCOME":
    case "REFUND":
    case "TRANSFER_IN":
      return amountCents;
    case "EXPENSE":
    case "TRANSFER_OUT":
      return -amountCents;
  }
}

/** Saldo = saldo inicial + efeito dos lançamentos efetivados. Pendentes entram só na projeção. */
export function calculateBalance(openingBalanceCents: number, entries: LedgerEntry[]): number {
  return entries
    .filter((entry) => entry.status === "POSTED")
    .reduce((sum, entry) => sum + balanceEffect(entry.type, entry.amountCents), openingBalanceCents);
}

export interface PeriodSummary {
  incomeCents: number;
  /** Despesas líquidas de estornos. */
  expenseCents: number;
  netCents: number;
  /** Percentual com uma casa decimal; null representa "N/D". */
  savingsRate: number | null;
}

/** Soma receitas e despesas efetivadas. Transferências não entram; estornos abatem despesas. */
export function summarizePeriod(entries: LedgerEntry[]): PeriodSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of entries) {
    if (entry.status !== "POSTED") continue;
    if (entry.type === "INCOME") incomeCents += entry.amountCents;
    else if (entry.type === "EXPENSE") expenseCents += entry.amountCents;
    else if (entry.type === "REFUND") expenseCents -= entry.amountCents;
  }
  const netCents = incomeCents - expenseCents;
  return {
    incomeCents,
    expenseCents,
    netCents,
    savingsRate: incomeCents > 0 ? Math.round((netCents / incomeCents) * 1000) / 10 : null,
  };
}
