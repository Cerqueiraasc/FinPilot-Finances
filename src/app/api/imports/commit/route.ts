import { IMPORT_MAX_BYTES, importCommitSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { commitImport } from "@/server/services/imports";

export const POST = authedRoute(
  {
    schema: importCommitSchema,
    bodyLimit: IMPORT_MAX_BYTES * 2,
    rateLimit: { scope: "import-commit", limit: 30, windowMs: 3600000 },
  },
  async ({ userId, body }) => commitImport(userId, body),
);
