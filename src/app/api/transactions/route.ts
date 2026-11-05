import { createTransactionSchema, transactionFiltersSchema } from "@/features/schemas";
import { authedRoute, searchParamsOf } from "@/lib/api/handler";
import { createTransaction, listTransactions } from "@/server/services/transactions";

export const GET = authedRoute({}, async ({ userId, request }) =>
  listTransactions(userId, transactionFiltersSchema.parse(searchParamsOf(request))),
);

export const POST = authedRoute({ schema: createTransactionSchema }, async ({ userId, body }) =>
  createTransaction(userId, body),
);
