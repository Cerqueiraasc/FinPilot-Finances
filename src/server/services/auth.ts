import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/security/password";
import { enforceRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { generateToken, hashToken } from "@/lib/security/tokens";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/schemas";
import { getEmailProvider } from "@/server/providers/email";
import { audit } from "./audit";
import { ensureDefaultCategories } from "./categories";
import { CURRENT_CONSENT_VERSION } from "./consent";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

async function issueToken(
  userId: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
  ttlMs: number,
): Promise<string> {
  const token = generateToken();
  // Um novo link invalida os anteriores do mesmo tipo.
  await db.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await issueToken(userId, "EMAIL_VERIFICATION", VERIFICATION_TTL_MS);
  await getEmailProvider().send({
    to: email,
    subject: "Confirme seu e-mail no FinPilot",
    text: `Para confirmar seu e-mail, acesse:\n${appUrl()}/verificar-email?token=${token}\n\nO link vale por 24 horas.`,
  });
}

export async function registerUser(input: z.infer<typeof registerSchema>): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  await ensureDefaultCategories();
  let user;
  try {
    user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        consents: {
          create: [
            { purpose: "TERMS", version: CURRENT_CONSENT_VERSION },
            { purpose: "PRIVACY_POLICY", version: CURRENT_CONSENT_VERSION },
          ],
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("EMAIL_IN_USE", "Este e-mail já está cadastrado.", 409, {
        email: ["Este e-mail já está cadastrado."],
      });
    }
    throw error;
  }
  await audit(db, user.id, "user.register", "User", user.id);
  await sendVerificationEmail(user.id, user.email);
  await createSession(user.id);
  return user.id;
}

const invalidCredentials = () =>
  new AppError("INVALID_CREDENTIALS", "E-mail ou senha incorretos.", 401);

export async function loginUser(input: z.infer<typeof loginSchema>, ip: string): Promise<void> {
  await enforceRateLimit("login-email", input.email, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  await enforceRateLimit("login-ip", ip, LOGIN_LIMIT * 5, LOGIN_WINDOW_MS);

  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await burnPasswordCheck(input.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();

  await resetRateLimit("login-email", input.email);
  await audit(db, user.id, "user.login", "Session");
  await createSession(user.id);
}

export async function loginDemoUser(): Promise<void> {
  if (process.env.DEMO_MODE_ENABLED !== "true") {
    throw new AppError("DEMO_DISABLED", "O modo demonstração não está habilitado.", 404);
  }
  const user = await db.user.findFirst({ where: { isDemo: true } });
  if (!user) {
    throw new AppError(
      "DEMO_NOT_SEEDED",
      "Os dados de demonstração ainda não foram criados. Execute npm run db:seed.",
      404,
    );
  }
  await createSession(user.id);
}

/** A resposta é a mesma para e-mail existente ou não, para não revelar cadastros. */
export async function requestPasswordReset(email: string, ip: string): Promise<void> {
  await enforceRateLimit("reset-email", email, 5, LOGIN_WINDOW_MS);
  await enforceRateLimit("reset-ip", ip, 20, LOGIN_WINDOW_MS);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.isDemo) return;
  const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MS);
  await getEmailProvider().send({
    to: user.email,
    subject: "Redefinição de senha do FinPilot",
    text: `Para criar uma nova senha, acesse:\n${appUrl()}/recuperar-senha?token=${token}\n\nO link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore esta mensagem.`,
  });
}

const invalidToken = () =>
  new AppError("INVALID_TOKEN", "Este link é inválido ou expirou. Solicite um novo.", 400);

/** Marca o token como usado de forma atômica: dois envios simultâneos não passam ambos. */
async function consumeToken(
  token: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
  client: Prisma.TransactionClient,
): Promise<string> {
  const tokenHash = hashToken(token);
  const stored = await client.authToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.type !== type) throw invalidToken();
  const claimed = await client.authToken.updateMany({
    where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw invalidToken();
  return stored.userId;
}

export async function resetPassword(input: z.infer<typeof resetPasswordSchema>): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    const userId = await consumeToken(input.token, "PASSWORD_RESET", tx);
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, userId, "user.password_reset", "User", userId);
  });
}

export async function verifyEmail(token: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const userId = await consumeToken(token, "EMAIL_VERIFICATION", tx);
    await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await audit(tx, userId, "user.email_verified", "User", userId);
  });
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isDemo) {
    throw new AppError("DEMO_READONLY", "A senha da conta de demonstração não pode ser alterada.", 403);
  }
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError("INVALID_CREDENTIALS", "Senha atual incorreta.", 400, {
      currentPassword: ["Senha atual incorreta."],
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Alterar a senha encerra as outras sessões.
    await tx.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    await audit(tx, userId, "user.password_change", "User", userId);
  });
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    current: session.id === currentSessionId,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const result = await db.session.deleteMany({ where: { id: sessionId, userId } });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Sessão não encontrada.", 404);
  await audit(db, userId, "session.revoke", "Session", sessionId);
}
