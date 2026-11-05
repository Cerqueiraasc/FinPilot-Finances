import { z } from "zod";
import { createBudgetSchema } from "@/features/schemas";
import { authedRoute, searchParamsOf } from "@/lib/api/handler";
import { createBudget, listBudgets } from "@/server/services/budgets";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const GET = authedRoute({}, async ({ userId, request }) => {
  const { year, month } = querySchema.parse(searchParamsOf(request));
  return { items: await listBudgets(userId, year, month) };
});

export const POST = authedRoute({ schema: createBudgetSchema }, async ({ userId, body }) =>
  createBudget(userId, body),
);
