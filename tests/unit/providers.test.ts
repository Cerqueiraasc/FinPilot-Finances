import { describe, expect, it } from "vitest";
import {
  MockBankingProvider,
  SIMULATED_BANKING_LABEL,
} from "@/server/providers/banking";
import { compoundProjection } from "@/features/insights/education";
import { outputUsesOnlyKnownValues, type MinimizedMetrics } from "@/features/insights/assistant";

describe("banco simulado", () => {
  it("rotula a conexão como demonstração e para de sincronizar após revogar", async () => {
    const provider = new MockBankingProvider();
    const connection = await provider.connect("user", "Banco");
    expect(connection.simulated).toBe(true);
    expect(connection.institution).toContain(SIMULATED_BANKING_LABEL);
    expect(await provider.syncTransactions("user", connection.id)).toHaveLength(1);
    expect(await provider.syncTransactions("outro", connection.id)).toEqual([]);

    await provider.revokeConsent("user", connection.id);
    expect(await provider.syncTransactions("user", connection.id)).toEqual([]);
  });
});

describe("simulador de juros compostos", () => {
  it("com taxa zero devolve apenas o aportado", () => {
    expect(compoundProjection(100000, 10000, 0, 1)).toEqual({
      finalCents: 220000,
      contributedCents: 220000,
      interestCents: 0,
    });
  });

  it("10% ao ano sobre R$ 1.000 resulta em R$ 1.100 após um ano", () => {
    expect(compoundProjection(100000, 0, 10, 1).finalCents).toBeCloseTo(110000, -1);
  });
});

describe("barreira contra valores inventados", () => {
  const metrics: MinimizedMetrics = {
    period: "2026-11",
    hasAccounts: true,
    balance: "R$ 1.000,00",
    plannedNext30Days: "-R$ 50,00",
    categories: [],
    budgets: [],
    goals: [],
    insightTypes: [],
  };
  const output = (summary: string) => ({
    title: "T",
    summary,
    evidence: [],
    suggestedActions: [],
    disclaimer: "D",
  });

  it("aceita valor presente nas métricas e texto sem valores", () => {
    expect(outputUsesOnlyKnownValues(output("Saldo de R$ 1.000,00."), metrics)).toBe(true);
    expect(outputUsesOnlyKnownValues(output("Sem valores aqui."), metrics)).toBe(true);
  });

  it("recusa valor que não foi enviado", () => {
    expect(outputUsesOnlyKnownValues(output("Saldo de R$ 9.999,00."), metrics)).toBe(false);
  });
});
