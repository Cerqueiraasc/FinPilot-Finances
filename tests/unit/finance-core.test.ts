import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/money";
import {
  addMonths,
  financialPeriod,
  isValidISODate,
  periodForDate,
  todayISO,
} from "@/lib/dates";
import {
  balanceEffect,
  calculateBalance,
  summarizePeriod,
} from "@/features/transactions/calculations";
import {
  budgetProgress,
  crossedAlertLevels,
  highestAlertLevel,
} from "@/features/budgets/calculations";
import { goalProgress, projectMonthsToGoal } from "@/features/goals/calculations";
import { occurrenceAt, occurrencesBetween } from "@/features/recurrences/calculations";
import { suggestCategoryId } from "@/features/categories/rules";

describe("dinheiro", () => {
  it("formata em BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(12590)).toBe("R$ 125,90");
  });

  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1,234.56", 123456],
    ["R$ 125,90", 12590],
    ["125,9", 12590],
    ["1.000", 100000],
    ["1.000.000", 100000000],
    ["-10,00", -1000],
    ["(10,00)", -1000],
    ["10,00-", -1000],
    ["0,07", 7],
  ])("interpreta %s", (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "12,345,6", "1.23.45", "1,234,5"])("rejeita %j", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });

  it("converte centavos para edição sem float", () => {
    expect(centsToInput(12590)).toBe("125,90");
    expect(centsToInput(7)).toBe("0,07");
  });

  it("não sofre erro de ponto flutuante (0,1 + 0,2)", () => {
    const cents = parseBRLToCents("0,10")! + parseBRLToCents("0,20")!;
    expect(cents).toBe(30);
  });
});

describe("cálculo de saldo (PRD §12)", () => {
  const entries = [
    { type: "INCOME", status: "POSTED", amountCents: 200000 },
    { type: "EXPENSE", status: "POSTED", amountCents: 50000 },
    { type: "TRANSFER_OUT", status: "POSTED", amountCents: 20000 },
  ] as const;

  it("reproduz o exemplo do PRD: consolidado de R$ 2.500", () => {
    const origin = calculateBalance(100000, [...entries]);
    const destination = calculateBalance(0, [
      { type: "TRANSFER_IN", status: "POSTED", amountCents: 20000 },
    ]);
    expect(origin + destination).toBe(250000);
  });

  it("despesa de R$ 125,90 reduz exatamente 12.590 centavos", () => {
    expect(balanceEffect("EXPENSE", 12590)).toBe(-12590);
    expect(
      calculateBalance(100000, [{ type: "EXPENSE", status: "POSTED", amountCents: 12590 }]),
    ).toBe(87410);
  });

  it("ignora pendentes e cancelados no saldo realizado", () => {
    expect(
      calculateBalance(1000, [
        { type: "EXPENSE", status: "PENDING", amountCents: 500 },
        { type: "EXPENSE", status: "CANCELED", amountCents: 500 },
      ]),
    ).toBe(1000);
  });

  it("transferência não altera receita nem despesa", () => {
    const summary = summarizePeriod([
      { type: "TRANSFER_OUT", status: "POSTED", amountCents: 30000 },
      { type: "TRANSFER_IN", status: "POSTED", amountCents: 30000 },
    ]);
    expect(summary).toEqual({ incomeCents: 0, expenseCents: 0, netCents: 0, savingsRate: null });
  });

  it("estorno abate despesa sem virar receita", () => {
    const summary = summarizePeriod([
      { type: "INCOME", status: "POSTED", amountCents: 100000 },
      { type: "EXPENSE", status: "POSTED", amountCents: 30000 },
      { type: "REFUND", status: "POSTED", amountCents: 10000 },
    ]);
    expect(summary.incomeCents).toBe(100000);
    expect(summary.expenseCents).toBe(20000);
    expect(summary.savingsRate).toBe(80);
  });
});

describe("orçamento (PRD §12)", () => {
  it("R$ 850 em R$ 1.000 = 85% com alerta de 80%", () => {
    expect(budgetProgress(85000, 100000)).toBe(85);
    expect(crossedAlertLevels(85000, 100000)).toEqual(["WARNING_80"]);
  });

  it("R$ 1.100 em R$ 1.000 = 110% com alerta de excesso", () => {
    expect(budgetProgress(110000, 100000)).toBe(110);
    expect(highestAlertLevel(110000, 100000)).toBe("EXCEEDED");
  });

  it("trata as fronteiras exatas de 80% e 100%", () => {
    expect(crossedAlertLevels(79999, 100000)).toEqual([]);
    expect(crossedAlertLevels(80000, 100000)).toEqual(["WARNING_80"]);
    expect(crossedAlertLevels(100000, 100000)).toEqual(["WARNING_80", "REACHED_100"]);
    expect(crossedAlertLevels(100001, 100000)).toEqual(["WARNING_80", "REACHED_100", "EXCEEDED"]);
  });
});

describe("metas (PRD §12)", () => {
  it("calcula progresso e faltante com contribuições líquidas", () => {
    expect(goalProgress(100000, 10000, [20000, -5000])).toEqual({
      savedCents: 25000,
      remainingCents: 75000,
      percent: 25,
    });
  });

  it("usa teto de meses e não prevê sem contribuição", () => {
    expect(projectMonthsToGoal(100001, 50000)).toBe(3);
    expect(projectMonthsToGoal(100000, 0)).toBeNull();
    expect(projectMonthsToGoal(0, 0)).toBe(0);
  });
});

describe("datas e fronteiras", () => {
  it("valida datas reais", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
  });

  it("usa o fuso de São Paulo na virada do dia", () => {
    expect(todayISO(new Date("2026-11-01T02:59:00.000Z"))).toBe("2026-10-31");
    expect(todayISO(new Date("2026-11-01T03:00:00.000Z"))).toBe("2026-11-01");
  });

  it("período mensal é inclusivo no início e exclusivo no fim", () => {
    expect(financialPeriod(2026, 12)).toMatchObject({ from: "2026-12-01", toExclusive: "2027-01-01" });
  });

  it("respeita o dia de início do mês financeiro", () => {
    expect(periodForDate("2026-03-04", 5)).toMatchObject({
      year: 2026,
      month: 2,
      from: "2026-02-05",
      toExclusive: "2026-03-05",
    });
    expect(periodForDate("2026-03-05", 5)).toMatchObject({ year: 2026, month: 3 });
    expect(periodForDate("2026-01-02", 5)).toMatchObject({ year: 2025, month: 12 });
  });

  it("limita a soma de meses ao fim do mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("recorrência", () => {
  it("mantém o dia âncora depois de um mês curto", () => {
    expect(occurrenceAt("2026-01-31", "MONTHLY", 1)).toBe("2026-02-28");
    expect(occurrenceAt("2026-01-31", "MONTHLY", 2)).toBe("2026-03-31");
  });

  it("respeita intervalo e fim da série", () => {
    expect(
      occurrencesBetween("2026-01-10", "MONTHLY", "2026-02-01", "2026-05-31", "2026-04-10"),
    ).toEqual(["2026-02-10", "2026-03-10", "2026-04-10"]);
  });
});

describe("categorização", () => {
  const rules = [
    { matchType: "CONTAINS", pattern: "padaria", categoryId: "user-1", priority: 2 },
    { matchType: "STARTS_WITH", pattern: "PADARIA DO ZÉ", categoryId: "user-2", priority: 1 },
  ] as const;

  it("aplica a regra de maior prioridade e ignora acentos", () => {
    expect(suggestCategoryId("Padaria do Ze centro", [...rules])).toBe("user-2");
  });

  it("regras do usuário vencem a heurística", () => {
    const heuristic = [{ id: "heur", name: "Alimentação" }];
    expect(suggestCategoryId("padaria nova", [...rules], heuristic)).toBe("user-1");
    expect(suggestCategoryId("supermercado", [], heuristic)).toBe("heur");
    expect(suggestCategoryId("outra coisa", [], heuristic)).toBeNull();
  });
});
