import { aiPreferenceSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { setAiPreference } from "@/server/services/consent";

export const POST = authedRoute({ schema: aiPreferenceSchema }, async ({ userId, body }) => {
  await setAiPreference(userId, body.enabled);
  return { ok: true };
});
