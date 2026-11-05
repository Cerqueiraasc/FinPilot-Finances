import { updateRecurrenceSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { deleteRecurrence, updateRecurrence } from "@/server/services/recurrences";

export const PATCH = authedRoute<ReturnType<typeof updateRecurrenceSchema.parse>, { id: string }>(
  { schema: updateRecurrenceSchema },
  async ({ userId, params, body }) => {
    await updateRecurrence(userId, params.id, body);
    return { ok: true };
  },
);

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteRecurrence(userId, params.id);
});
