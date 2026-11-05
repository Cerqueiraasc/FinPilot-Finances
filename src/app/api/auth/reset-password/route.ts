import { resetPasswordSchema } from "@/features/schemas";
import { publicRoute } from "@/lib/api/handler";
import { resetPassword } from "@/server/services/auth";

export const POST = publicRoute(
  { schema: resetPasswordSchema, rateLimit: { scope: "reset", limit: 20, windowMs: 900000 } },
  async ({ body }) => {
    await resetPassword(body);
    return { ok: true };
  },
);
