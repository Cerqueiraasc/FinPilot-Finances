import { registerSchema } from "@/features/schemas";
import { publicRoute } from "@/lib/api/handler";
import { registerUser } from "@/server/services/auth";

export const POST = publicRoute(
  { schema: registerSchema, rateLimit: { scope: "register", limit: 20, windowMs: 3600000 } },
  async ({ body }) => {
    await registerUser(body);
    return { ok: true };
  },
);
