import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type DbClient } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { suggestCategoryId } from "@/features/categories/rules";
import { createCategorySchema, createRuleSchema } from "@/features/schemas";
import { getAccessibleCategory } from "@/server/repositories/ownership";

export const DEFAULT_CATEGORIES = [
  { id: "cat_moradia", name: "Moradia", type: "EXPENSE", color: "#2a78d6" },
  { id: "cat_alimentacao", name: "Alimentação", type: "EXPENSE", color: "#eb6834" },
  { id: "cat_transporte", name: "Transporte", type: "EXPENSE", color: "#1baf7a" },
  { id: "cat_saude", name: "Saúde", type: "EXPENSE", color: "#eda100" },
  { id: "cat_educacao", name: "Educação", type: "EXPENSE", color: "#e87ba4" },
  { id: "cat_lazer", name: "Lazer", type: "EXPENSE", color: "#008300" },
  { id: "cat_assinaturas", name: "Assinaturas", type: "EXPENSE", color: "#6250d6" },
  { id: "cat_compras", name: "Compras", type: "EXPENSE", color: "#e34948" },
  { id: "cat_impostos", name: "Impostos", type: "EXPENSE", color: "#7a7a75" },
  { id: "cat_outros_despesa", name: "Outros", type: "EXPENSE", color: "#a3a29c" },
  { id: "cat_salario", name: "Salário", type: "INCOME", color: "#2a78d6" },
  { id: "cat_freelance", name: "Freelance", type: "INCOME", color: "#1baf7a" },
  { id: "cat_rendimentos", name: "Rendimentos", type: "INCOME", color: "#008300" },
  { id: "cat_outros_receita", name: "Outros", type: "INCOME", color: "#a3a29c" },
] as const;

/** Idempotente: pode rodar em todo cadastro e no seed. */
export async function ensureDefaultCategories(client: DbClient = db): Promise<void> {
  await client.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId: null })),
    skipDuplicates: true,
  });
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string | null;
  isDefault: boolean;
}

export async function listCategories(userId: string): Promise<CategoryDTO[]> {
  const categories = await db.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    isDefault: category.userId === null,
  }));
}

export async function createCategory(
  userId: string,
  input: z.infer<typeof createCategorySchema>,
): Promise<{ id: string }> {
  const duplicateDefault = await db.category.findFirst({
    where: {
      name: { equals: input.name, mode: "insensitive" },
      type: input.type,
      OR: [{ userId }, { userId: null }],
    },
  });
  if (duplicateDefault) {
    throw new AppError("CONFLICT", "Já existe uma categoria com esse nome e tipo.", 409, {
      name: ["Já existe uma categoria com esse nome e tipo."],
    });
  }
  try {
    const category = await db.category.create({
      data: { userId, name: input.name, type: input.type, color: input.color ?? null },
    });
    return { id: category.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("CONFLICT", "Já existe uma categoria com esse nome e tipo.", 409);
    }
    throw error;
  }
}

/** Lançamentos da categoria ficam sem categoria; categorias padrão não podem ser removidas. */
export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const result = await db.category.deleteMany({ where: { id: categoryId, userId } });
  if (result.count === 0) throw notFound("Categoria");
}

export async function listRules(userId: string) {
  const rules = await db.categoryRule.findMany({
    where: { userId },
    include: { category: { select: { name: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return rules.map((rule) => ({
    id: rule.id,
    matchType: rule.matchType,
    pattern: rule.pattern,
    categoryId: rule.categoryId,
    categoryName: rule.category.name,
    priority: rule.priority,
  }));
}

export async function createRule(
  userId: string,
  input: z.infer<typeof createRuleSchema>,
): Promise<{ id: string }> {
  await getAccessibleCategory(db, userId, input.categoryId);
  const rule = await db.categoryRule.create({ data: { userId, ...input } });
  return { id: rule.id };
}

/** Sugestão editável para o formulário: regras do usuário primeiro, depois a heurística. */
export async function suggestCategoryForUser(
  userId: string,
  description: string,
  type: "INCOME" | "EXPENSE" | "REFUND",
): Promise<string | null> {
  const categoryType = type === "INCOME" ? "INCOME" : "EXPENSE";
  const [rules, categories] = await Promise.all([
    db.categoryRule.findMany({
      where: { userId, category: { type: categoryType } },
      select: { matchType: true, pattern: true, categoryId: true, priority: true },
    }),
    db.category.findMany({
      where: { type: categoryType, OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true },
    }),
  ]);
  return suggestCategoryId(description, rules, categories);
}

export async function deleteRule(userId: string, ruleId: string): Promise<void> {
  const result = await db.categoryRule.deleteMany({ where: { id: ruleId, userId } });
  if (result.count === 0) throw notFound("Regra");
}
