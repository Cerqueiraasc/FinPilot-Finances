import { assistantExplainSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { explainForUser } from "@/server/services/insights";

export const POST = authedRoute(
  {
    schema: assistantExplainSchema,
    rateLimit: { scope: "assistant", limit: 30, windowMs: 3600000 },
  },
  async ({ userId, body }) => explainForUser(userId, body.question),
);
