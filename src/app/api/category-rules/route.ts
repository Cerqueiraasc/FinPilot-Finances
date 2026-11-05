import { createRuleSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createRule, listRules } from "@/server/services/categories";

export const GET = authedRoute({}, async ({ userId }) => ({ items: await listRules(userId) }));

export const POST = authedRoute({ schema: createRuleSchema }, async ({ userId, body }) =>
  createRule(userId, body),
);
