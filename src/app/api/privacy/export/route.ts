import { authedRoute } from "@/lib/api/handler";
import { exportUserData } from "@/server/services/profile";

export const POST = authedRoute(
  { rateLimit: { scope: "privacy-export", limit: 10, windowMs: 3600000 } },
  async ({ userId }) =>
    new Response(JSON.stringify(await exportUserData(userId), null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="finpilot-meus-dados.json"',
        "Cache-Control": "no-store",
      },
    }),
);
