import { createContributionSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { addContribution } from "@/server/services/goals";

export const POST = authedRoute<ReturnType<typeof createContributionSchema.parse>, { id: string }>(
  { schema: createContributionSchema },
  async ({ userId, params, body }) => addContribution(userId, params.id, body),
);
