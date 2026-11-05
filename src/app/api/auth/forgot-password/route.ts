import { forgotPasswordSchema } from "@/features/schemas";
import { clientIp, publicRoute } from "@/lib/api/handler";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = publicRoute({ schema: forgotPasswordSchema }, async ({ body, request }) => {
  await requestPasswordReset(body.email, clientIp(request));
  return { ok: true };
});
