import { IMPORT_MAX_BYTES, importPreviewSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { previewImport } from "@/server/services/imports";

export const POST = authedRoute(
  {
    schema: importPreviewSchema,
    bodyLimit: IMPORT_MAX_BYTES + 4096,
    rateLimit: { scope: "import-preview", limit: 60, windowMs: 3600000 },
  },
  async ({ userId, body }) => previewImport(userId, body),
);
