import { authedRoute } from "@/lib/api/handler";
import { destroyCurrentSession } from "@/lib/auth/session";

export const POST = authedRoute({}, async () => {
  await destroyCurrentSession();
});
