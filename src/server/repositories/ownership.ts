import type { Account, Category } from "@/generated/prisma/client";
import type { DbClient } from "@/lib/db";
import { notFound, validationError } from "@/lib/errors";

/** Toda consulta por ID passa pelo dono. Recurso alheio responde como inexistente. */
export async function getOwnedAccount(
  client: DbClient,
  userId: string,
  accountId: string,
): Promise<Account> {
  const account = await client.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw notFound("Conta");
  return account;
}

/** Categorias acessíveis: as padrão (sem dono) e as do próprio usuário. */
export async function getAccessibleCategory(
  client: DbClient,
  userId: string,
  categoryId: string,
): Promise<Category> {
  const category = await client.category.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
  });
  if (!category) throw notFound("Categoria");
  return category;
}

export function assertCategoryCompatible(
  category: Category,
  transactionType: "INCOME" | "EXPENSE" | "REFUND",
): void {
  const expected = transactionType === "INCOME" ? "INCOME" : "EXPENSE";
  if (category.type !== expected) {
    throw validationError(
      "categoryId",
      expected === "INCOME"
        ? "Escolha uma categoria de receita."
        : "Escolha uma categoria de despesa.",
    );
  }
}
