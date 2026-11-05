import { changePasswordSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { changePassword } from "@/server/services/auth";

export const POST = authedRoute(
  { schema: changePasswordSchema, rateLimit: { scope: "password", limit: 10, windowMs: 900000 } },
  async ({ userId, session, body }) => {
    await changePassword(userId, session.sessionId, body);
    return { ok: true };
  },
);
