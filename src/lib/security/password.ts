import { hash, verify } from "@node-rs/argon2";

// Parâmetros mínimos recomendados pela OWASP para Argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

/** Hash descartável para igualar o tempo de resposta quando o e-mail não existe. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("finpilot-dummy-password");
  await verifyPassword(await dummyHash, password);
}
