import { onboardingSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { completeOnboarding } from "@/server/services/profile";

export const POST = authedRoute({ schema: onboardingSchema }, async ({ userId, body }) => {
  await completeOnboarding(userId, body);
  return { ok: true };
});
