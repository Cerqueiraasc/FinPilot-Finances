import { publicRoute } from "@/lib/api/handler";
import { loginDemoUser } from "@/server/services/auth";

export const POST = publicRoute(
  { rateLimit: { scope: "demo", limit: 60, windowMs: 3600000 } },
  async () => {
    await loginDemoUser();
    return { ok: true };
  },
);
