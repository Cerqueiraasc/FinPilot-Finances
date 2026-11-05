import { updateGoalSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { deleteGoal, updateGoal } from "@/server/services/goals";

export const PATCH = authedRoute<ReturnType<typeof updateGoalSchema.parse>, { id: string }>(
  { schema: updateGoalSchema },
  async ({ userId, params, body }) => {
    await updateGoal(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteGoal(userId, params.id);
});
