import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbClient } from "@/lib/db";
import { dateToISO, isoToDate, todayISO } from "@/lib/dates";
import { AppError, notFound, validationError } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import { computeDedupeHash } from "@/features/imports/csv";
import { balanceEffect, type LedgerType } from "@/features/transactions/calculations";
import {
  createTransactionSchema,
  createTransferSchema,
  updateTransactionSchema,
  type TransactionFilters,
} from "@/features/schemas";
import {
  assertCategoryCompatible,
  getAccessibleCategory,
  getOwnedAccount,
} from "@/server/repositories/ownership";
import { audit } from "./audit";
import { syncBudgetAlerts } from "./budgets";

export interface TransactionDTO {
  id: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  type: LedgerType;
  amountCents: number;
  description: string;
  transactionDate: string;
  status: "PENDING" | "POSTED" | "CANCELED";
  source: "MANUAL" | "CSV" | "OPEN_FINANCE" | "RECURRENCE";
  notes: string | null;
  tags: string[];
  transferId: string | null;
  recurrenceRuleId: string | null;
}

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    account: { select: { name: true } };
    category: { select: { name: true; color: true } };
  };
}>;

function toDTO(row: TransactionWithRelations): TransactionDTO {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account.name,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categoryColor: row.category?.color ?? null,
    type: row.type,
    amountCents: centsToNumber(row.amountCents),
    description: row.description,
    transactionDate: dateToISO(row.transactionDate),
    status: row.status,
    source: row.source,
    notes: row.notes,
    tags: row.tags,
    transferId: row.transferId,
    recurrenceRuleId: row.recurrenceRuleId,
  };
}

const relations = {
  account: { select: { name: true } },
  category: { select: { name: true, color: true } },
} as const;

export function filtersToWhere(
  userId: string,
  filters: Omit<TransactionFilters, "page" | "pageSize">,
): Prisma.TransactionWhereInput {
  return {
    userId,
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type === "TRANSFER"
      ? { type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] as ("TRANSFER_IN" | "TRANSFER_OUT")[] } }
      : filters.type
        ? { type: filters.type }
        : {}),
    ...(filters.from || filters.to
      ? {
          transactionDate: {
            ...(filters.from ? { gte: isoToDate(filters.from) } : {}),
            ...(filters.to ? { lte: isoToDate(filters.to) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search, mode: "insensitive" as const } },
            { notes: { contains: filters.search, mode: "insensitive" as const } },
            { tags: { has: filters.search } },
          ],
        }
      : {}),
  };
}

export async function listTransactions(userId: string, filters: TransactionFilters) {
  const where = filtersToWhere(userId, filters);
  const [rows, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: relations,
      // O id garante ordenação estável entre páginas com a mesma data.
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    db.transaction.count({ where }),
  ]);
  return {
    items: rows.map(toDTO),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(Math.ceil(total / filters.pageSize), 1),
  };
}

export async function getTransaction(userId: string, id: string): Promise<TransactionDTO> {
  const row = await db.transaction.findFirst({ where: { id, userId }, include: relations });
  if (!row) throw notFound("Transação");
  return toDTO(row);
}

export function hashForEntry(input: {
  accountId: string;
  date: string;
  type: LedgerType;
  amountCents: number;
  description: string;
  externalId?: string | null;
}): string {
  return computeDedupeHash({
    accountId: input.accountId,
    date: input.date,
    signedAmountCents: balanceEffect(input.type, input.amountCents),
    description: input.description,
    externalId: input.externalId,
  });
}

async function assertCategoryForType(
  client: DbClient,
  userId: string,
  categoryId: string | null | undefined,
  type: "INCOME" | "EXPENSE" | "REFUND",
): Promise<void> {
  if (!categoryId) return;
  assertCategoryCompatible(await getAccessibleCategory(client, userId, categoryId), type);
}

export async function createTransaction(
  userId: string,
  input: z.infer<typeof createTransactionSchema>,
): Promise<{ id: string }> {
  if (input.status === "POSTED" && input.transactionDate > todayISO()) {
    throw validationError(
      "status",
      "Lançamentos com data futura ficam como previstos até a data chegar.",
    );
  }
  return db.$transaction(async (tx) => {
    const account = await getOwnedAccount(tx, userId, input.accountId);
    if (account.archivedAt) throw validationError("accountId", "Esta conta está arquivada.");
    await assertCategoryForType(tx, userId, input.categoryId, input.type);
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        type: input.type,
        amountCents: BigInt(input.amountCents),
        description: input.description,
        transactionDate: isoToDate(input.transactionDate),
        status: input.status,
        source: "MANUAL",
        notes: input.notes ?? null,
        tags: input.tags,
        dedupeHash: hashForEntry({
          accountId: input.accountId,
          date: input.transactionDate,
          type: input.type,
          amountCents: input.amountCents,
          description: input.description,
        }),
      },
    });
    await syncBudgetAlerts(tx, userId, input.categoryId ?? null, input.transactionDate);
    await audit(tx, userId, "transaction.create", "Transaction", created.id);
    return { id: created.id };
  });
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: z.infer<typeof updateTransactionSchema>,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.transaction.findFirst({ where: { id, userId } });
    if (!current) throw notFound("Transação");
    if (current.transferId) {
      throw new AppError(
        "TRANSFER_LEG",
        "Edite a transferência como um todo para manter as duas contas consistentes.",
        409,
      );
    }
    const type = (input.type ?? current.type) as "INCOME" | "EXPENSE" | "REFUND";
    const accountId = input.accountId ?? current.accountId;
    const date = input.transactionDate ?? dateToISO(current.transactionDate);
    const status = input.status ?? current.status;
    const amountCents = input.amountCents ?? centsToNumber(current.amountCents);
    const description = input.description ?? current.description;
    const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;

    if (status === "POSTED" && date > todayISO()) {
      throw validationError(
        "status",
        "Lançamentos com data futura ficam como previstos até a data chegar.",
      );
    }
    if (input.accountId) await getOwnedAccount(tx, userId, input.accountId);
    await assertCategoryForType(tx, userId, categoryId, type);

    await tx.transaction.update({
      where: { id: current.id },
      data: {
        accountId,
        categoryId,
        type,
        amountCents: BigInt(amountCents),
        description,
        transactionDate: isoToDate(date),
        status,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        // Ocorrência editada deixa de seguir a série.
        isOccurrenceOverride: current.recurrenceRuleId ? true : current.isOccurrenceOverride,
        // Importados mantêm o hash original: reenviar o arquivo continua detectando a duplicata.
        dedupeHash:
          current.source === "MANUAL"
            ? hashForEntry({ accountId, date, type, amountCents, description })
            : current.dedupeHash,
      },
    });
    await syncBudgetAlerts(tx, userId, categoryId, date);
    await audit(tx, userId, "transaction.update", "Transaction", id);
  });
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.transaction.findFirst({ where: { id, userId } });
    if (!current) throw notFound("Transação");
    if (current.transferId) {
      throw new AppError("TRANSFER_LEG", "Exclua a transferência como um todo.", 409);
    }
    if (current.recurrenceRuleId) {
      // Ocorrência cancelada permanece para a série não recriá-la.
      await tx.transaction.update({
        where: { id: current.id },
        data: { status: "CANCELED", isOccurrenceOverride: true },
      });
    } else {
      await tx.transaction.delete({ where: { id: current.id } });
    }
    await audit(tx, userId, "transaction.delete", "Transaction", id);
  });
}

function transferLegs(
  userId: string,
  transferId: string,
  input: z.infer<typeof createTransferSchema>,
  status: "POSTED" | "PENDING",
) {
  const common = {
    userId,
    transferId,
    amountCents: BigInt(input.amountCents),
    description: input.description,
    transactionDate: isoToDate(input.transferDate),
    status,
    source: "MANUAL" as const,
  };
  return [
    { ...common, accountId: input.fromAccountId, type: "TRANSFER_OUT" as const },
    { ...common, accountId: input.toAccountId, type: "TRANSFER_IN" as const },
  ];
}

async function assertTransferAccounts(
  tx: DbClient,
  userId: string,
  input: z.infer<typeof createTransferSchema>,
): Promise<void> {
  const [from, to] = await Promise.all([
    getOwnedAccount(tx, userId, input.fromAccountId),
    getOwnedAccount(tx, userId, input.toAccountId),
  ]);
  if (from.archivedAt || to.archivedAt) {
    throw validationError("fromAccountId", "Contas arquivadas não recebem novas transferências.");
  }
}

/** As duas pernas são gravadas na mesma transação de banco, ou nenhuma é. */
export async function createTransfer(
  userId: string,
  input: z.infer<typeof createTransferSchema>,
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    await assertTransferAccounts(tx, userId, input);
    const transfer = await tx.transfer.create({
      data: {
        userId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountCents: BigInt(input.amountCents),
        transferDate: isoToDate(input.transferDate),
        description: input.description,
      },
    });
    const status = input.transferDate > todayISO() ? "PENDING" : "POSTED";
    await tx.transaction.createMany({ data: transferLegs(userId, transfer.id, input, status) });
    await audit(tx, userId, "transfer.create", "Transfer", transfer.id);
    return { id: transfer.id };
  });
}

export async function updateTransfer(
  userId: string,
  id: string,
  input: z.infer<typeof createTransferSchema>,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const transfer = await tx.transfer.findFirst({ where: { id, userId } });
    if (!transfer) throw notFound("Transferência");
    await assertTransferAccounts(tx, userId, input);
    await tx.transfer.update({
      where: { id },
      data: {
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountCents: BigInt(input.amountCents),
        transferDate: isoToDate(input.transferDate),
        description: input.description,
      },
    });
    await tx.transaction.deleteMany({ where: { transferId: id, userId } });
    const status = input.transferDate > todayISO() ? "PENDING" : "POSTED";
    await tx.transaction.createMany({ data: transferLegs(userId, id, input, status) });
    await audit(tx, userId, "transfer.update", "Transfer", id);
  });
}

export async function deleteTransfer(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const result = await tx.transfer.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw notFound("Transferência");
    await audit(tx, userId, "transfer.delete", "Transfer", id);
  });
}

export async function getTransfer(userId: string, id: string) {
  const transfer = await db.transfer.findFirst({ where: { id, userId } });
  if (!transfer) throw notFound("Transferência");
  return {
    id: transfer.id,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    amountCents: centsToNumber(transfer.amountCents),
    transferDate: dateToISO(transfer.transferDate),
    description: transfer.description,
  };
}
