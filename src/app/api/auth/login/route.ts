import { loginSchema } from "@/features/schemas";
import { clientIp, publicRoute } from "@/lib/api/handler";
import { loginUser } from "@/server/services/auth";

export const POST = publicRoute({ schema: loginSchema }, async ({ body, request }) => {
  await loginUser(body, clientIp(request));
  return { ok: true };
});
