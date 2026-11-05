import { createHash, randomBytes } from "node:crypto";

/** Token opaco de 256 bits. Apenas o hash é persistido. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
