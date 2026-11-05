import { updateBudgetSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { deleteBudget, updateBudget } from "@/server/services/budgets";

export const PATCH = authedRoute<ReturnType<typeof updateBudgetSchema.parse>, { id: string }>(
  { schema: updateBudgetSchema },
  async ({ userId, params, body }) => {
    await updateBudget(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteBudget(userId, params.id);
});
