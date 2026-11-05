import { z } from "zod";
import { db } from "@/lib/db";
import { addDays, dateToISO, formatDate } from "@/lib/dates";
import { centsToNumber, centsToInput } from "@/lib/money";
import { reportFiltersSchema } from "@/features/schemas";
import { periodSummary } from "@/server/repositories/ledger";
import { getOwnedAccount } from "@/server/repositories/ownership";
import { balanceEffect, type LedgerType } from "@/features/transactions/calculations";
import { categorySlices } from "./dashboard";
import { filtersToWhere } from "./transactions";

type ReportFilters = z.infer<typeof reportFiltersSchema>;

async function assertFilterOwnership(userId: string, filters: ReportFilters) {
  if (filters.accountId) await getOwnedAccount(db, userId, filters.accountId);
}

export async function getReport(userId: string, filters: ReportFilters) {
  await assertFilterOwnership(userId, filters);
  const range = {
    from: filters.from,
    toExclusive: addDays(filters.to, 1),
    accountId: filters.accountId,
    categoryId: filters.categoryId,
  };
  const [summary, categories, transactionCount] = await Promise.all([
    periodSummary(db, userId, range),
    categorySlices(userId, range),
    db.transaction.count({
      where: filtersToWhere(userId, { ...filters, status: "POSTED" }),
    }),
  ]);
  return { summary, categories, transactionCount };
}

/** Evita que células sejam interpretadas como fórmula ao abrir o CSV em planilhas. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const TYPE_LABEL: Record<LedgerType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  REFUND: "Estorno",
  TRANSFER_IN: "Transferência recebida",
  TRANSFER_OUT: "Transferência enviada",
};
const STATUS_LABEL = { PENDING: "Previsto", POSTED: "Efetivado", CANCELED: "Cancelado" } as const;

export async function exportTransactionsCsv(userId: string, filters: ReportFilters): Promise<string> {
  await assertFilterOwnership(userId, filters);
  const rows = await db.transaction.findMany({
    where: filtersToWhere(userId, filters),
    include: { account: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
  });
  const header = "Data;Descrição;Tipo;Situação;Conta;Categoria;Valor (R$);Tags;Observações";
  const lines = rows.map((row) => {
    const signed = balanceEffect(row.type, centsToNumber(row.amountCents));
    return [
      formatDate(dateToISO(row.transactionDate)),
      csvCell(row.description),
      TYPE_LABEL[row.type],
      STATUS_LABEL[row.status],
      csvCell(row.account.name),
      csvCell(row.category?.name ?? ""),
      centsToInput(signed),
      csvCell(row.tags.join(", ")),
      csvCell(row.notes ?? ""),
    ].join(";");
  });
  // O BOM faz o Excel reconhecer UTF-8 e os acentos.
  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}
