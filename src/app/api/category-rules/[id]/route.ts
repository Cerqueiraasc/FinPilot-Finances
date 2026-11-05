import { authedRoute } from "@/lib/api/handler";
import { deleteRule } from "@/server/services/categories";

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteRule(userId, params.id);
});
