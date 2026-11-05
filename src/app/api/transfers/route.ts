import { createTransferSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createTransfer } from "@/server/services/transactions";

export const POST = authedRoute({ schema: createTransferSchema }, async ({ userId, body }) =>
  createTransfer(userId, body),
);
