import { createTransferSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { deleteTransfer, getTransfer, updateTransfer } from "@/server/services/transactions";

export const GET = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) =>
  getTransfer(userId, params.id),
);

export const PATCH = authedRoute<ReturnType<typeof createTransferSchema.parse>, { id: string }>(
  { schema: createTransferSchema },
  async ({ userId, params, body }) => {
    await updateTransfer(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteTransfer(userId, params.id);
});
