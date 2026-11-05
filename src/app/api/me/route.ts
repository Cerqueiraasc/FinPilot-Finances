import { profileSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { updateProfile } from "@/server/services/profile";

export const PATCH = authedRoute({ schema: profileSchema }, async ({ userId, body }) => {
  await updateProfile(userId, body);
  return { ok: true };
});
