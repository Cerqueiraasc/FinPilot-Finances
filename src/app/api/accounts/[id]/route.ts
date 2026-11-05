import { updateAccountSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { deleteAccount, updateAccount } from "@/server/services/accounts";

export const PATCH = authedRoute<ReturnType<typeof updateAccountSchema.parse>, { id: string }>(
  { schema: updateAccountSchema },
  async ({ userId, params, body }) => {
    await updateAccount(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteAccount(userId, params.id);
});
