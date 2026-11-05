import { createGoalSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createGoal, listGoals } from "@/server/services/goals";

export const GET = authedRoute({}, async ({ userId }) => ({ items: await listGoals(userId) }));

export const POST = authedRoute({ schema: createGoalSchema }, async ({ userId, body }) =>
  createGoal(userId, body),
);
