import { reportFiltersSchema } from "@/features/schemas";
import { authedRoute, searchParamsOf } from "@/lib/api/handler";
import { exportTransactionsCsv } from "@/server/services/reports";

export const GET = authedRoute({}, async ({ userId, request }) => {
  const filters = reportFiltersSchema.parse(searchParamsOf(request));
  const csv = await exportTransactionsCsv(userId, filters);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finpilot-${filters.from}-a-${filters.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
