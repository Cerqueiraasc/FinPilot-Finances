import { createRecurrenceSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createRecurrence, listRecurrences } from "@/server/services/recurrences";

export const GET = authedRoute({}, async ({ userId }) => ({ items: await listRecurrences(userId) }));

export const POST = authedRoute({ schema: createRecurrenceSchema }, async ({ userId, body }) =>
  createRecurrence(userId, body),
);
