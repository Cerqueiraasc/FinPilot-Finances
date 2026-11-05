import { authedRoute } from "@/lib/api/handler";
import { getDashboard } from "@/server/services/dashboard";

export const GET = authedRoute({}, async ({ userId, session }) =>
  getDashboard(userId, session.user.financialMonthStartDay),
);
