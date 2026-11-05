import { verifyEmailSchema } from "@/features/schemas";
import { publicRoute } from "@/lib/api/handler";
import { verifyEmail } from "@/server/services/auth";

export const POST = publicRoute(
  { schema: verifyEmailSchema, rateLimit: { scope: "verify", limit: 20, windowMs: 900000 } },
  async ({ body }) => {
    await verifyEmail(body.token);
    return { ok: true };
  },
);
