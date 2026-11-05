import { authedRoute } from "@/lib/api/handler";
import { markAlertRead } from "@/server/services/budgets";

export const POST = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await markAlertRead(userId, params.id);
  return { ok: true };
});
