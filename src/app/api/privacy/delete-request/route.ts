import { deleteAccountSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { destroyCurrentSession } from "@/lib/auth/session";
import { deleteUserAccount } from "@/server/services/profile";

export const POST = authedRoute(
  {
    schema: deleteAccountSchema,
    rateLimit: { scope: "privacy-delete", limit: 5, windowMs: 900000 },
  },
  async ({ userId, body }) => {
    await deleteUserAccount(userId, body);
    await destroyCurrentSession();
    return { ok: true };
  },
);
