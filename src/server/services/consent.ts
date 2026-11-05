import { db } from "@/lib/db";
import { audit } from "./audit";

export const CURRENT_CONSENT_VERSION = "2026-11-rascunho";

export async function listConsents(userId: string) {
  return db.consent.findMany({
    where: { userId },
    orderBy: { grantedAt: "desc" },
    select: { id: true, purpose: true, version: true, grantedAt: true, revokedAt: true },
  });
}

export async function hasActiveAiConsent(userId: string): Promise<boolean> {
  const consent = await db.consent.findFirst({
    where: { userId, purpose: "AI_PROCESSING", revokedAt: null },
    select: { id: true },
  });
  return consent !== null;
}

/** Cada mudança fica registrada: conceder cria um registro, revogar preenche a data. */
export async function setAiPreference(userId: string, enabled: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.consent.updateMany({
      where: { userId, purpose: "AI_PROCESSING", revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (enabled) {
      await tx.consent.create({
        data: { userId, purpose: "AI_PROCESSING", version: CURRENT_CONSENT_VERSION },
      });
    }
    await tx.user.update({ where: { id: userId }, data: { aiEnabled: enabled } });
    await audit(tx, userId, enabled ? "consent.ai_grant" : "consent.ai_revoke", "Consent");
  });
}
