import { createAccountSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createAccount, listAccounts } from "@/server/services/accounts";

export const GET = authedRoute({}, async ({ userId }) => ({
  items: await listAccounts(userId, { includeArchived: true }),
}));

export const POST = authedRoute({ schema: createAccountSchema }, async ({ userId, body }) =>
  createAccount(userId, body),
);
