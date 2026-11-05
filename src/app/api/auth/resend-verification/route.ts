import { authedRoute } from "@/lib/api/handler";
import { sendVerificationEmail } from "@/server/services/auth";

export const POST = authedRoute(
  { rateLimit: { scope: "resend-verification", limit: 5, windowMs: 3600000 } },
  async ({ session }) => {
    if (!session.user.emailVerifiedAt) {
      await sendVerificationEmail(session.user.id, session.user.email);
    }
    return { ok: true };
  },
);
