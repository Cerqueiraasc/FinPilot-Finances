import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import { createAccountSchema, updateAccountSchema } from "@/features/schemas";
import { postedTotalsByAccount } from "@/server/repositories/ledger";
import { audit } from "./audit";

export interface AccountDTO {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH";
  institution: string | null;
  color: string | null;
  openingBalanceCents: number;
  balanceCents: number;
  archived: boolean;
  transactionCount: number;
}

export async function listAccounts(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<AccountDTO[]> {
  const [accounts, totals] = await Promise.all([
    db.account.findMany({
      where: { userId, ...(options.includeArchived ? {} : { archivedAt: null }) },
      include: { _count: { select: { transactions: true } } },
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    }),
    postedTotalsByAccount(db, userId),
  ]);
  return accounts.map((account) => {
    const openingBalanceCents = centsToNumber(account.openingBalanceCents);
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      color: account.color,
      openingBalanceCents,
      balanceCents: openingBalanceCents + (totals.get(account.id) ?? 0),
      archived: account.archivedAt !== null,
      transactionCount: account._count.transactions,
    };
  });
}

export async function createAccount(
  userId: string,
  input: z.infer<typeof createAccountSchema>,
): Promise<{ id: string }> {
  const account = await db.account.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
      color: input.color ?? null,
      openingBalanceCents: BigInt(input.openingBalanceCents),
    },
  });
  await audit(db, userId, "account.create", "Account", account.id);
  return { id: account.id };
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: z.infer<typeof updateAccountSchema>,
): Promise<void> {
  const { archived, openingBalanceCents, ...rest } = input;
  const result = await db.account.updateMany({
    where: { id: accountId, userId },
    data: {
      ...rest,
      ...(openingBalanceCents !== undefined
        ? { openingBalanceCents: BigInt(openingBalanceCents) }
        : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
    },
  });
  if (result.count === 0) throw notFound("Conta");
  await audit(db, userId, "account.update", "Account", accountId);
}

/** Exclusão só para conta sem histórico; com lançamentos, o caminho é arquivar. */
export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    include: {
      _count: { select: { transactions: true, recurrences: true, importBatches: true } },
    },
  });
  if (!account) throw notFound("Conta");
  const { transactions, recurrences, importBatches } = account._count;
  if (transactions + recurrences + importBatches > 0) {
    throw new AppError(
      "ACCOUNT_HAS_HISTORY",
      "Esta conta tem lançamentos. Arquive-a para preservar o histórico.",
      409,
    );
  }
  await db.account.delete({ where: { id: accountId } });
  await audit(db, userId, "account.delete", "Account", accountId);
}
