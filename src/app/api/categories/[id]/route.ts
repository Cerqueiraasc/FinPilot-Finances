import { authedRoute } from "@/lib/api/handler";
import { deleteCategory } from "@/server/services/categories";

export const DELETE = authedRoute<undefined, { id: string }>({}, async ({ userId, params }) => {
  await deleteCategory(userId, params.id);
});
