import { authedRoute } from "@/lib/api/handler";
import { listInsights } from "@/server/services/insights";

export const GET = authedRoute({}, async ({ userId }) => ({ items: await listInsights(userId) }));
