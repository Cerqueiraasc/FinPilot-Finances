import { authedRoute } from "@/lib/api/handler";
import { listSessions } from "@/server/services/auth";

export const GET = authedRoute({}, async ({ userId, session }) => ({
  items: await listSessions(userId, session.sessionId),
}));
