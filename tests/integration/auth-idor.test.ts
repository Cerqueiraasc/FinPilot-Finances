import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
  headers: async () => new Headers({ host: "localhost:3000", "user-agent": "vitest" }),
}));

import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { memoryOutbox } from "@/server/providers/email";
import { explainForUser } from "@/server/services/insights";
import { setAiPreference } from "@/server/services/consent";
import { deleteUserAccount, exportUserData } from "@/server/services/profile";
import { hashPassword } from "@/lib/security/password";
import * as accountRoute from "@/app/api/accounts/[id]/route";
import * as transactionsRoute from "@/app/api/transactions/route";
import * as transactionRoute from "@/app/api/transactions/[id]/route";
import * as transfersRoute from "@/app/api/transfers/route";
import * as transferRoute from "@/app/api/transfers/[id]/route";
import * as budgetRoute from "@/app/api/budgets/[id]/route";
import * as goalRoute from "@/app/api/goals/[id]/route";
import * as contributionsRoute from "@/app/api/goals/[id]/contributions/route";
import * as recurrenceRoute from "@/app/api/recurrences/[id]/route";
import * as ruleRoute from "@/app/api/category-rules/[id]/route";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as sessionRoute from "@/app/api/me/sessions/[id]/route";
import * as previewRoute from "@/app/api/imports/preview/route";
import * as registerRoute from "@/app/api/auth/register/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as forgotRoute from "@/app/api/auth/forgot-password/route";
import * as resetRoute from "@/app/api/auth/reset-password/route";
import * as passwordRoute from "@/app/api/me/password/route";
import { createAccount, createUser, resetDatabase } from "./helpers";

const BASE = "http://localhost:3000";
const today = todayISO();

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = <P extends object>(params: P) => ({ params: Promise.resolve(params) });

async function signIn(userId: string): Promise<string> {
  const token = generateToken();
  const session = await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) },
  });
  cookieJar.set(SESSION_COOKIE, token);
  return session.id;
}

beforeEach(async () => {
  await resetDatabase();
  cookieJar.clear();
  memoryOutbox.length = 0;
});

describe("isolamento entre usuários (IDOR)", () => {
  async function victimData() {
    const victim = await createUser();
    const account = await createAccount(victim.id, 1000, "Vítima A");
    const other = await createAccount(victim.id, 0, "Vítima B");
    const transaction = await db.transaction.create({
      data: {
        userId: victim.id,
        accountId: account.id,
        type: "EXPENSE",
        amountCents: BigInt(100),
        description: "Segredo",
        transactionDate: new Date(`${today}T00:00:00.000Z`),
      },
    });
    const transfer = await db.transfer.create({
      data: {
        userId: victim.id,
        fromAccountId: account.id,
        toAccountId: other.id,
        amountCents: BigInt(100),
        transferDate: new Date(`${today}T00:00:00.000Z`),
        description: "T",
      },
    });
    const budget = await db.budget.create({
      data: { userId: victim.id, categoryId: "cat_lazer", year: 2026, month: 1, limitCents: BigInt(100) },
    });
    const goal = await db.goal.create({
      data: { userId: victim.id, title: "Meta", targetCents: BigInt(100) },
    });
    const recurrence = await db.recurrenceRule.create({
      data: {
        userId: victim.id,
        accountId: account.id,
        type: "EXPENSE",
        amountCents: BigInt(100),
        description: "R",
        cadence: "MONTHLY",
        startDate: new Date(`${today}T00:00:00.000Z`),
        nextRunAt: new Date(`${today}T00:00:00.000Z`),
      },
    });
    const category = await db.category.create({
      data: { userId: victim.id, name: "Particular", type: "EXPENSE" },
    });
    const rule = await db.categoryRule.create({
      data: { userId: victim.id, pattern: "abc", categoryId: "cat_lazer" },
    });
    const session = await db.session.create({
      data: { userId: victim.id, tokenHash: "vitima", expiresAt: new Date(Date.now() + 3600000) },
    });
    return { victim, account, other, transaction, transfer, budget, goal, recurrence, category, rule, session };
  }

  it("responde 404 em toda leitura e mutação por ID conhecido, sem alterar nada", async () => {
    const data = await victimData();
    const attacker = await createUser();
    await signIn(attacker.id);

    const attempts: [string, () => Promise<Response>][] = [
      ["conta PATCH", () => accountRoute.PATCH(request("PATCH", "/x", { name: "Hack" }), ctx({ id: data.account.id }))],
      ["conta DELETE", () => accountRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.other.id }))],
      ["transação GET", () => transactionRoute.GET(request("GET", "/x"), ctx({ id: data.transaction.id }))],
      ["transação PATCH", () => transactionRoute.PATCH(request("PATCH", "/x", { amountCents: 1 }), ctx({ id: data.transaction.id }))],
      ["transação DELETE", () => transactionRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.transaction.id }))],
      ["transferência GET", () => transferRoute.GET(request("GET", "/x"), ctx({ id: data.transfer.id }))],
      ["transferência DELETE", () => transferRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.transfer.id }))],
      ["orçamento PATCH", () => budgetRoute.PATCH(request("PATCH", "/x", { limitCents: 5 }), ctx({ id: data.budget.id }))],
      ["orçamento DELETE", () => budgetRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.budget.id }))],
      ["meta PATCH", () => goalRoute.PATCH(request("PATCH", "/x", { title: "Hack" }), ctx({ id: data.goal.id }))],
      ["meta DELETE", () => goalRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.goal.id }))],
      ["aporte POST", () => contributionsRoute.POST(request("POST", "/x", { amountCents: 5, contributionDate: today }), ctx({ id: data.goal.id }))],
      ["recorrência PATCH", () => recurrenceRoute.PATCH(request("PATCH", "/x", { active: false }), ctx({ id: data.recurrence.id }))],
      ["recorrência DELETE", () => recurrenceRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.recurrence.id }))],
      ["regra DELETE", () => ruleRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.rule.id }))],
      ["categoria DELETE", () => categoryRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.category.id }))],
      ["sessão DELETE", () => sessionRoute.DELETE(request("DELETE", "/x"), ctx({ id: data.session.id }))],
    ];
    for (const [name, attempt] of attempts) {
      const response = await attempt();
      expect(response.status, name).toBe(404);
    }

    expect(await db.account.count({ where: { userId: data.victim.id } })).toBe(2);
    expect(await db.transaction.count({ where: { userId: data.victim.id } })).toBe(1);
    expect(await db.goal.count({ where: { userId: data.victim.id, title: "Meta" } })).toBe(1);
    expect(await db.session.count({ where: { id: data.session.id } })).toBe(1);
    const account = await db.account.findUniqueOrThrow({ where: { id: data.account.id } });
    expect(account.name).toBe("Vítima A");
  });

  it("não aceita conta ou categoria alheia ao criar registros", async () => {
    const data = await victimData();
    const attacker = await createUser();
    const own = await createAccount(attacker.id);
    await signIn(attacker.id);

    const base = {
      type: "EXPENSE",
      amountCents: 100,
      description: "x",
      transactionDate: today,
    };
    expect(
      (await transactionsRoute.POST(request("POST", "/x", { ...base, accountId: data.account.id }), ctx({}))).status,
    ).toBe(404);
    expect(
      (await transactionsRoute.POST(
        request("POST", "/x", { ...base, accountId: own.id, categoryId: data.category.id }),
        ctx({}),
      )).status,
    ).toBe(404);
    expect(
      (await transfersRoute.POST(
        request("POST", "/x", {
          fromAccountId: data.account.id,
          toAccountId: own.id,
          amountCents: 100,
          transferDate: today,
        }),
        ctx({}),
      )).status,
    ).toBe(404);
    expect(
      (await previewRoute.POST(
        request("POST", "/x", { accountId: data.account.id, filename: "a.csv", csvText: "a;b\n1;2" }),
        ctx({}),
      )).status,
    ).toBe(404);
  });

  it("listagem traz somente dados do próprio usuário e ignora userId enviado", async () => {
    const data = await victimData();
    const attacker = await createUser();
    await signIn(attacker.id);
    const response = await transactionsRoute.GET(
      request("GET", `/api/transactions?userId=${data.victim.id}&search=Segredo`),
      ctx({}),
    );
    expect((await response.json()).total).toBe(0);
  });
});

describe("autenticação", () => {
  it("rotas privadas respondem 401 sem sessão, sem detalhes internos", async () => {
    const response = await transactionsRoute.GET(request("GET", "/api/transactions"), ctx({}));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
  });

  it("recusa mutação de outra origem", async () => {
    const user = await createUser();
    await signIn(user.id);
    const response = await transactionsRoute.POST(
      request("POST", "/x", {}, { origin: "https://site-malicioso.example" }),
      ctx({}),
    );
    expect(response.status).toBe(403);
  });

  it("devolve erros de validação padronizados", async () => {
    const user = await createUser();
    await signIn(user.id);
    const response = await transactionsRoute.POST(
      request("POST", "/x", { amountCents: -1, description: "" }),
      ctx({}),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fieldErrors.amountCents[0]).toContain("maior que zero");
  });

  const credentials = {
    name: "Pessoa",
    email: "Pessoa@Example.test",
    password: "senha-bem-longa-1",
    acceptTerms: true,
  };

  it("cadastra, grava apenas o hash, envia verificação e recusa e-mail repetido", async () => {
    const created = await registerRoute.POST(request("POST", "/x", credentials), ctx({}));
    expect(created.status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { email: "pessoa@example.test" } });
    expect(user.passwordHash).not.toContain(credentials.password);
    expect(user.passwordHash.startsWith("$argon2")).toBe(true);
    expect(memoryOutbox[0].subject).toContain("Confirme");
    expect(await db.consent.count({ where: { userId: user.id } })).toBe(2);

    const repeated = await registerRoute.POST(request("POST", "/x", credentials), ctx({}));
    expect(repeated.status).toBe(409);
  });

  it("limita tentativas de login por e-mail", async () => {
    await registerRoute.POST(request("POST", "/x", credentials), ctx({}));
    const attempt = () =>
      loginRoute.POST(
        request("POST", "/x", { email: credentials.email, password: "senha-errada" }),
        ctx({}),
      );
    for (let index = 0; index < 10; index += 1) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
  }, 60000);

  it("recuperação usa token de uso único e encerra as sessões", async () => {
    await registerRoute.POST(request("POST", "/x", credentials), ctx({}));
    memoryOutbox.length = 0;
    const forgot = await forgotRoute.POST(request("POST", "/x", { email: credentials.email }), ctx({}));
    expect(forgot.status).toBe(200);
    const token = /token=([\w-]+)/.exec(memoryOutbox[0].text)![1];

    const reset = () =>
      resetRoute.POST(request("POST", "/x", { token, password: "nova-senha-longa-2" }), ctx({}));
    expect((await reset()).status).toBe(200);
    expect(await db.session.count()).toBe(0);
    expect((await reset()).status).toBe(400);
  });

  it("recusa token expirado", async () => {
    const user = await createUser();
    const token = generateToken();
    await db.authToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const response = await resetRoute.POST(
      request("POST", "/x", { token, password: "nova-senha-longa-2" }),
      ctx({}),
    );
    expect(response.status).toBe(400);
  });

  it("não revela se o e-mail existe na recuperação", async () => {
    const response = await forgotRoute.POST(
      request("POST", "/x", { email: "ninguem@example.test" }),
      ctx({}),
    );
    expect(response.status).toBe(200);
    expect(memoryOutbox).toHaveLength(0);
  });

  it("alterar a senha revoga as outras sessões e mantém a atual", async () => {
    const user = await db.user.create({
      data: { name: "P", email: "p@example.test", passwordHash: await hashPassword("senha-atual-longa") },
    });
    const currentId = await signIn(user.id);
    await db.session.create({
      data: { userId: user.id, tokenHash: "outra", expiresAt: new Date(Date.now() + 3600000) },
    });
    const response = await passwordRoute.POST(
      request("POST", "/x", { currentPassword: "senha-atual-longa", newPassword: "senha-nova-longa-3" }),
      ctx({}),
    );
    expect(response.status).toBe(200);
    const sessions = await db.session.findMany({ where: { userId: user.id } });
    expect(sessions.map((item) => item.id)).toEqual([currentId]);
  });
});

describe("assistente", () => {
  async function userWithData() {
    const user = await createUser();
    await createAccount(user.id, 100000);
    return user;
  }

  it("funciona sem chave de IA e não fabrica números", async () => {
    const user = await userWithData();
    const result = await explainForUser(user.id, "qual meu saldo?", null);
    expect(result.source).toBe("deterministic");
    expect(result.summary).toContain("R$ 1.000,00");
  });

  it("não chama a IA sem opt-in", async () => {
    const user = await userWithData();
    const explain = vi.fn();
    const result = await explainForUser(user.id, undefined, { explain });
    expect(explain).not.toHaveBeenCalled();
    expect(result.source).toBe("deterministic");
  });

  it("com opt-in envia só métricas minimizadas", async () => {
    const user = await userWithData();
    await setAiPreference(user.id, true);
    await db.goal.create({ data: { userId: user.id, title: "Título privado", targetCents: BigInt(100) } });
    const explain = vi.fn().mockResolvedValue({
      title: "Resumo",
      summary: "Seu saldo é R$ 1.000,00.",
      evidence: [],
      suggestedActions: [],
      disclaimer: "Educativo.",
    });
    const result = await explainForUser(user.id, undefined, { explain });
    expect(result.source).toBe("ai");
    expect(JSON.stringify(explain.mock.calls[0][0])).not.toContain("Título privado");
  });

  it("descarta resposta da IA que cita valor inexistente", async () => {
    const user = await userWithData();
    await setAiPreference(user.id, true);
    const explain = vi.fn().mockResolvedValue({
      title: "Resumo",
      summary: "Você tem R$ 1.000.000,00 disponíveis.",
      evidence: [],
      suggestedActions: [],
      disclaimer: "Educativo.",
    });
    expect((await explainForUser(user.id, undefined, { explain })).source).toBe("deterministic");
  });

  it("usa o fallback quando a IA falha ou o consentimento é revogado", async () => {
    const user = await userWithData();
    await setAiPreference(user.id, true);
    expect(
      (await explainForUser(user.id, undefined, { explain: vi.fn().mockResolvedValue(null) })).source,
    ).toBe("deterministic");
    await setAiPreference(user.id, false);
    const consent = await db.consent.findFirstOrThrow({ where: { userId: user.id } });
    expect(consent.revokedAt).not.toBeNull();
  });
});

describe("privacidade", () => {
  it("exporta os dados sem hash de senha", async () => {
    const user = await createUser();
    await createAccount(user.id, 100);
    const exported = JSON.stringify(await exportUserData(user.id));
    expect(exported).toContain("finpilot-export-v1");
    expect(exported).not.toContain("passwordHash");
  });

  it("exclusão exige senha e remove todos os dados em cascata", async () => {
    const user = await db.user.create({
      data: { name: "P", email: "d@example.test", passwordHash: await hashPassword("senha-excluir-1") },
    });
    const account = await createAccount(user.id, 100);
    await db.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        type: "EXPENSE",
        amountCents: BigInt(100),
        description: "x",
        transactionDate: new Date(`${today}T00:00:00.000Z`),
      },
    });
    await expect(
      deleteUserAccount(user.id, { password: "errada", confirmation: "EXCLUIR" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await deleteUserAccount(user.id, { password: "senha-excluir-1", confirmation: "EXCLUIR" });
    expect(await db.user.count({ where: { id: user.id } })).toBe(0);
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.account.count({ where: { userId: user.id } })).toBe(0);
  });
});
