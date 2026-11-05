import { authedRoute } from "@/lib/api/handler";
import { revokeSession } from "@/server/services/auth";

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await revokeSession(userId, params.id);
});
