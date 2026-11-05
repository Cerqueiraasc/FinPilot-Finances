import { createCategorySchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { createCategory, listCategories } from "@/server/services/categories";

export const GET = authedRoute({}, async ({ userId }) => ({ items: await listCategories(userId) }));

export const POST = authedRoute({ schema: createCategorySchema }, async ({ userId, body }) =>
  createCategory(userId, body),
);
