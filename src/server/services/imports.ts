import { z } from "zod";
import { db } from "@/lib/db";
import { isoToDate } from "@/lib/dates";
import { AppError, validationError } from "@/lib/errors";
import { suggestCategoryId } from "@/features/categories/rules";
import {
  computeDedupeHash,
  fileChecksum,
  normalizeRows,
  parseCsv,
  suggestMapping,
} from "@/features/imports/csv";
import { importCommitSchema, importPreviewSchema } from "@/features/schemas";
import { getOwnedAccount } from "@/server/repositories/ownership";
import { audit } from "./audit";
import { syncBudgetAlerts } from "./budgets";

const MAX_ROWS = 20000;

export interface PreviewRow {
  rowIndex: number;
  date: string | null;
  description: string;
  signedAmountCents: number | null;
  externalId: string | null;
  errors: string[];
  duplicate: "EXISTING" | "IN_FILE" | null;
  suggestedCategoryId: string | null;
}

async function classifyRows(
  userId: string,
  accountId: string,
  input: z.infer<typeof importCommitSchema>,
): Promise<(PreviewRow & { hash: string | null })[]> {
  const { rows } = parseCsv(input.csvText);
  if (rows.length > MAX_ROWS) {
    throw validationError("csvText", `O arquivo excede o limite de ${MAX_ROWS} linhas.`);
  }
  const normalized = normalizeRows(rows, input.mapping, input.dateFormat);
  const hashes = normalized.map((row) =>
    row.errors.length === 0
      ? computeDedupeHash({
          accountId,
          date: row.date!,
          signedAmountCents: row.signedAmountCents!,
          description: row.description,
          externalId: row.externalId,
        })
      : null,
  );
  const known = await db.transaction.findMany({
    where: { userId, dedupeHash: { in: hashes.filter((hash): hash is string => hash !== null) } },
    select: { dedupeHash: true },
  });
  const existing = new Set(known.map((row) => row.dedupeHash));

  const [rules, categories] = await Promise.all([
    db.categoryRule.findMany({
      where: { userId },
      select: { matchType: true, pattern: true, categoryId: true, priority: true, category: { select: { type: true } } },
    }),
    db.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const seen = new Set<string>();
  return normalized.map((row, index) => {
    const hash = hashes[index];
    let duplicate: PreviewRow["duplicate"] = null;
    if (hash) {
      if (existing.has(hash)) duplicate = "EXISTING";
      else if (seen.has(hash)) duplicate = "IN_FILE";
      seen.add(hash);
    }
    const categoryType = (row.signedAmountCents ?? 0) > 0 ? "INCOME" : "EXPENSE";
    return {
      ...row,
      hash,
      duplicate,
      suggestedCategoryId: row.description
        ? suggestCategoryId(
            row.description,
            rules.filter((rule) => rule.category.type === categoryType),
            categories.filter((category) => category.type === categoryType),
          )
        : null,
    };
  });
}

export async function previewImport(userId: string, input: z.infer<typeof importPreviewSchema>) {
  await getOwnedAccount(db, userId, input.accountId);
  const parsed = parseCsv(input.csvText);
  if (parsed.headers.length === 0) throw validationError("csvText", "O arquivo está vazio.");
  const suggested = suggestMapping(parsed.headers);
  const mapping = input.mapping ?? {
    date: suggested.date ?? -1,
    description: suggested.description ?? -1,
    amount: suggested.amount ?? -1,
    externalId: suggested.externalId ?? null,
  };
  const checksum = fileChecksum(input.csvText);
  const previousBatch = await db.importBatch.findFirst({
    where: { userId, accountId: input.accountId, checksum },
    select: { createdAt: true },
  });
  const base = {
    headers: parsed.headers,
    totalRows: parsed.rows.length,
    sample: parsed.rows.slice(0, 3),
    mapping,
    alreadyImported: previousBatch !== null,
  };
  if (mapping.date < 0 || mapping.description < 0 || mapping.amount < 0) {
    return { ...base, mappingComplete: false, rows: [] as PreviewRow[] };
  }
  const rows = await classifyRows(userId, input.accountId, {
    ...input,
    mapping,
    decisions: [],
  });
  return {
    ...base,
    mappingComplete: true,
    rows: rows.map(({ hash, ...row }) => row),
  };
}

/**
 * Grava o lote inteiro em uma transação serializável: a checagem de duplicatas é refeita
 * aqui, de modo que reenvios concorrentes não dupliquem. Duplicata só entra com
 * inclusão explícita do usuário.
 */
export async function commitImport(userId: string, input: z.infer<typeof importCommitSchema>) {
  await getOwnedAccount(db, userId, input.accountId);
  const classified = await classifyRows(userId, input.accountId, input);
  const decisions = new Map(input.decisions.map((decision) => [decision.rowIndex, decision]));

  const accessible = await db.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    select: { id: true, type: true },
  });
  const categoryType = new Map(accessible.map((category) => [category.id, category.type]));

  let skipped = 0;
  let duplicates = 0;
  let errors = 0;
  const data = classified.flatMap((row) => {
    if (row.errors.length > 0) {
      errors += 1;
      return [];
    }
    if (row.duplicate) duplicates += 1;
    const decision = decisions.get(row.rowIndex);
    const include = decision ? decision.include : row.duplicate === null;
    if (!include) {
      skipped += 1;
      return [];
    }
    const signed = row.signedAmountCents!;
    const type = signed > 0 ? ("INCOME" as const) : ("EXPENSE" as const);
    const expectedCategoryType = type;
    const chosen = decision?.categoryId === undefined ? row.suggestedCategoryId : decision.categoryId;
    if (chosen && !categoryType.has(chosen)) {
      throw new AppError("NOT_FOUND", "Categoria não encontrada.", 404);
    }
    return [
      {
        userId,
        accountId: input.accountId,
        categoryId: chosen && categoryType.get(chosen) === expectedCategoryType ? chosen : null,
        type,
        amountCents: BigInt(Math.abs(signed)),
        description: row.description,
        transactionDate: isoToDate(row.date!),
        status: "POSTED" as const,
        source: "CSV" as const,
        externalId: row.externalId,
        dedupeHash: row.hash,
      },
    ];
  });

  const result = await db.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          userId,
          accountId: input.accountId,
          filename: input.filename,
          checksum: fileChecksum(input.csvText),
          importedCount: data.length,
          skippedCount: skipped,
          duplicateCount: duplicates,
          errorCount: errors,
        },
      });
      await tx.transaction.createMany({
        data: data.map((row) => ({ ...row, importBatchId: batch.id })),
      });
      const affected = new Map<string, { categoryId: string; date: string }>();
      for (const row of data) {
        if (!row.categoryId) continue;
        const date = row.transactionDate.toISOString().slice(0, 10);
        affected.set(`${row.categoryId}|${date.slice(0, 7)}|${date}`, {
          categoryId: row.categoryId,
          date,
        });
      }
      for (const { categoryId, date } of affected.values()) {
        await syncBudgetAlerts(tx, userId, categoryId, date);
      }
      await audit(tx, userId, "import.commit", "ImportBatch", batch.id);
      return batch;
    },
    { isolationLevel: "Serializable", timeout: 60000 },
  );

  return {
    batchId: result.id,
    imported: data.length,
    skipped,
    duplicates,
    errors,
  };
}
