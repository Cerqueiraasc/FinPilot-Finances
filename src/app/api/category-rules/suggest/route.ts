import { z } from "zod";
import { authedRoute } from "@/lib/api/handler";
import { suggestCategoryForUser } from "@/server/services/categories";

const schema = z.object({
  description: z.string().trim().min(1).max(200),
  type: z.enum(["INCOME", "EXPENSE", "REFUND"]),
});

export const POST = authedRoute({ schema }, async ({ userId, body }) => ({
  categoryId: await suggestCategoryForUser(userId, body.description, body.type),
}));
