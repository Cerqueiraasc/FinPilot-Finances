import type { DbClient } from "@/lib/db";

/** Registra a ação e o alvo, sem valores nem textos do usuário. */
export async function audit(
  client: DbClient,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
): Promise<void> {
  await client.auditEvent.create({ data: { userId, action, entityType, entityId } });
}
