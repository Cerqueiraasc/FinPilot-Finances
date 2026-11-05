import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { listAccounts } from "@/server/services/accounts";
import { createBudget, listActiveAlerts, listBudgets } from "@/server/services/budgets";
import { getDashboard } from "@/server/services/dashboard";
import { commitImport, previewImport } from "@/server/services/imports";
import { createRecurrence, materializeRecurrences, updateRecurrence } from "@/server/services/recurrences";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  deleteTransfer,
  updateTransaction,
} from "@/server/services/transactions";
import { createAccount, createUser, resetDatabase } from "./helpers";

const today = todayISO();
const [year, month] = today.split("-").map(Number);

function expense(accountId: string, amountCents: number, categoryId: string | null = null) {
  return {
    accountId,
    categoryId,
    type: "EXPENSE" as const,
    amountCents,
    description: "Compra",
    transactionDate: today,
    status: "POSTED" as const,
    tags: [],
  };
}

async function totalBalance(userId: string) {
  const accounts = await listAccounts(userId);
  return accounts.reduce((sum, account) => sum + account.balanceCents, 0);
}

beforeEach(resetDatabase);

describe("saldos e transferências", () => {
  it("despesa de R$ 125,90 reduz exatamente 12.590 centavos", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, 100000);
    await createTransaction(user.id, expense(account.id, 12590));
    expect(await totalBalance(user.id)).toBe(100000 - 12590);
  });

  it("transferência de R$ 300 mantém o consolidado e não altera receita nem despesa", async () => {
    const user = await createUser();
    const from = await createAccount(user.id, 100000, "A");
    const to = await createAccount(user.id, 0, "B");
    const { id } = await createTransfer(user.id, {
      fromAccountId: from.id,
      toAccountId: to.id,
      amountCents: 30000,
      transferDate: today,
      description: "Transferência",
    });

    const accounts = await listAccounts(user.id);
    expect(accounts.find((item) => item.id === from.id)?.balanceCents).toBe(70000);
    expect(accounts.find((item) => item.id === to.id)?.balanceCents).toBe(30000);

    const dashboard = await getDashboard(user.id, 1);
    expect(dashboard.balanceCents).toBe(100000);
    expect(dashboard.summary.incomeCents).toBe(0);
    expect(dashboard.summary.expenseCents).toBe(0);

    await deleteTransfer(user.id, id);
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it("lançamento previsto não afeta o saldo e entra na projeção", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, 50000);
    await createTransaction(user.id, {
      ...expense(account.id, 10000),
      transactionDate: addDays(today, 5),
      status: "PENDING",
    });
    const dashboard = await getDashboard(user.id, 1);
    expect(dashboard.balanceCents).toBe(50000);
    expect(dashboard.plannedNet30DaysCents).toBe(-10000);
  });

  it("rejeita valor efetivado em data futura", async () => {
    const user = await createUser();
    const account = await createAccount(user.id);
    await expect(
      createTransaction(user.id, { ...expense(account.id, 100), transactionDate: addDays(today, 3) }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("criar, editar e excluir mantém dashboard e orçamento consistentes", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, 100000);
    await createBudget(user.id, { categoryId: "cat_lazer", year, month, limitCents: 10000 });

    const { id } = await createTransaction(user.id, expense(account.id, 5000, "cat_lazer"));
    expect((await listBudgets(user.id, year, month))[0].spentCents).toBe(5000);
    expect((await getDashboard(user.id, 1)).summary.expenseCents).toBe(5000);

    await updateTransaction(user.id, id, { amountCents: 7000 });
    expect((await listBudgets(user.id, year, month))[0].spentCents).toBe(7000);
    expect((await getDashboard(user.id, 1)).balanceCents).toBe(93000);

    await deleteTransaction(user.id, id);
    expect((await listBudgets(user.id, year, month))[0].spentCents).toBe(0);
    expect((await getDashboard(user.id, 1)).balanceCents).toBe(100000);
  });

  it("recusa categoria incompatível com o tipo", async () => {
    const user = await createUser();
    const account = await createAccount(user.id);
    await expect(
      createTransaction(user.id, expense(account.id, 100, "cat_salario")),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("alertas de orçamento", () => {
  it("dispara 80%, 100% e excesso sem repetir", async () => {
    const user = await createUser();
    const account = await createAccount(user.id, 500000);
    await createBudget(user.id, { categoryId: "cat_lazer", year, month, limitCents: 100000 });
    const levels = async () =>
      (await db.budgetAlert.findMany({ where: { userId: user.id } })).map((item) => item.level).sort();

    await createTransaction(user.id, expense(account.id, 85000, "cat_lazer"));
    expect(await levels()).toEqual(["WARNING_80"]);

    await createTransaction(user.id, expense(account.id, 1000, "cat_lazer"));
    expect(await levels()).toEqual(["WARNING_80"]);

    await createTransaction(user.id, expense(account.id, 14000, "cat_lazer"));
    expect(await levels()).toEqual(["REACHED_100", "WARNING_80"]);

    await createTransaction(user.id, expense(account.id, 10000, "cat_lazer"));
    expect(await levels()).toEqual(["EXCEEDED", "REACHED_100", "WARNING_80"]);

    const active = await listActiveAlerts(user.id);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ level: "EXCEEDED", percent: 110 });
  });
});

describe("recorrências", () => {
  it("gera ocorrências de forma idempotente", async () => {
    const user = await createUser();
    const account = await createAccount(user.id);
    await createRecurrence(user.id, {
      accountId: account.id,
      type: "EXPENSE",
      amountCents: 1000,
      description: "Assinatura",
      cadence: "WEEKLY",
      startDate: addDays(today, -14),
      tags: [],
    });
    const count = () => db.transaction.count({ where: { userId: user.id } });
    const before = await count();
    expect(before).toBeGreaterThan(3);

    await db.recurrenceRule.updateMany({
      where: { userId: user.id },
      data: { nextRunAt: new Date(`${addDays(today, -14)}T00:00:00.000Z`) },
    });
    await materializeRecurrences(user.id);
    expect(await count()).toBe(before);
  });

  it("edição da série preserva ocorrência editada individualmente", async () => {
    const user = await createUser();
    const account = await createAccount(user.id);
    const { id: ruleId } = await createRecurrence(user.id, {
      accountId: account.id,
      type: "EXPENSE",
      amountCents: 1000,
      description: "Assinatura",
      cadence: "WEEKLY",
      startDate: addDays(today, 7),
      tags: [],
    });
    const [first] = await db.transaction.findMany({
      where: { recurrenceRuleId: ruleId },
      orderBy: { transactionDate: "asc" },
    });
    await updateTransaction(user.id, first.id, { amountCents: 2000 });
    await updateRecurrence(user.id, ruleId, { amountCents: 3000 });

    const rows = await db.transaction.findMany({
      where: { recurrenceRuleId: ruleId },
      orderBy: { transactionDate: "asc" },
    });
    expect(Number(rows[0].amountCents)).toBe(2000);
    expect(rows.slice(1).every((row) => Number(row.amountCents) === 3000)).toBe(true);
  });
});

describe("importação CSV", () => {
  const csvText = "Data;Descrição;Valor\n01/02/2026;Mercado;-10,50\n02/02/2026;Salário;1000,00\n";
  const mapping = { date: 0, description: 1, amount: 2 };

  async function setup() {
    const user = await createUser();
    const account = await createAccount(user.id);
    const base = {
      accountId: account.id,
      filename: "extrato.csv",
      csvText,
      dateFormat: "DD/MM/YYYY" as const,
    };
    return { user, account, base };
  }

  it("mostra prévia sem gravar nada", async () => {
    const { user, base } = await setup();
    const preview = await previewImport(user.id, base);
    expect(preview.mappingComplete).toBe(true);
    expect(preview.rows).toHaveLength(2);
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it("não duplica ao reenviar o mesmo arquivo", async () => {
    const { user, base } = await setup();
    const first = await commitImport(user.id, { ...base, mapping, decisions: [] });
    expect(first.imported).toBe(2);

    const preview = await previewImport(user.id, base);
    expect(preview.alreadyImported).toBe(true);
    expect(preview.rows.every((row) => row.duplicate === "EXISTING")).toBe(true);

    const second = await commitImport(user.id, { ...base, mapping, decisions: [] });
    expect(second).toMatchObject({ imported: 0, duplicates: 2, skipped: 2 });
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(2);
  });

  it("permite importar duplicata por decisão explícita", async () => {
    const { user, base } = await setup();
    await commitImport(user.id, { ...base, mapping, decisions: [] });
    const result = await commitImport(user.id, {
      ...base,
      mapping,
      decisions: [{ rowIndex: 0, include: true }],
    });
    expect(result.imported).toBe(1);
    expect(await db.transaction.count({ where: { userId: user.id } })).toBe(3);
  });

  it("detecta duplicata dentro do próprio arquivo e ignora linha inválida", async () => {
    const { user, base } = await setup();
    const result = await commitImport(user.id, {
      ...base,
      csvText: "Data;Descrição;Valor\n01/02/2026;Café;-5,00\n01/02/2026;Café;-5,00\nxx;;abc\n",
      mapping,
      decisions: [],
    });
    expect(result).toMatchObject({ imported: 1, duplicates: 1, errors: 1 });
  });
});
