import { updateTransactionSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/server/services/transactions";

export const GET = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) =>
  getTransaction(userId, params.id),
);

export const PATCH = authedRoute<ReturnType<typeof updateTransactionSchema.parse>, { id: string }>(
  { schema: updateTransactionSchema },
  async ({ userId, params, body }) => {
    await updateTransaction(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteTransaction(userId, params.id);
});
