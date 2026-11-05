import { authedRoute } from "@/lib/api/handler";
import { deleteContribution } from "@/server/services/goals";

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteContribution(userId, params.id);
});
