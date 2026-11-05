import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hashToken } from "./tokens";

/**
 * Janela fixa persistida no banco, para valer entre instâncias do servidor.
 * A chave é hasheada para não guardar e-mail ou IP em texto puro.
 */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const key = `${scope}:${hashToken(identifier)}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  if (rows[0].count > limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      429,
    );
  }
}

export async function resetRateLimit(scope: string, identifier: string): Promise<void> {
  await db.rateLimitBucket.deleteMany({ where: { key: `${scope}:${hashToken(identifier)}` } });
}
