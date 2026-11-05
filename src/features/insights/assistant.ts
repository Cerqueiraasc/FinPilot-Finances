import { z } from "zod";
import { formatBRL } from "@/lib/money";
import type { DeterministicInsight, InsightMetrics } from "./engine";

export const ASSISTANT_DISCLAIMER =
  "Conteúdo educativo, baseado apenas nos seus registros. Não é aconselhamento financeiro profissional nem recomendação de investimento.";

export const assistantOutputSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1500),
  evidence: z.array(z.string().max(300)).max(10),
  suggestedActions: z.array(z.string().max(300)).max(5),
  disclaimer: z.string().min(1).max(400),
});
export type AssistantOutput = z.infer<typeof assistantOutputSchema>;

export interface AssistantResponse extends AssistantOutput {
  source: "deterministic" | "ai";
}

export interface MinimizedMetrics {
  period: string;
  hasAccounts: boolean;
  balance: string;
  plannedNext30Days: string;
  categories: { name: string; current: string; previous: string }[];
  budgets: { name: string; limit: string; spent: string }[];
  goals: { label: string; remaining: string; requiredPerMonth: string | null; averagePerMonth: string }[];
  insightTypes: { type: string; severity: string }[];
}

/**
 * Único dado enviado à IA: agregados formatados. Descrições, notas, títulos de metas e
 * nomes de contas ficam de fora; categorias personalizadas entram com nome genérico.
 */
export function minimizeMetrics(
  metrics: InsightMetrics,
  insights: DeterministicInsight[],
  defaultCategoryIds: ReadonlySet<string>,
): MinimizedMetrics {
  const label = (id: string, name: string, index: number) =>
    defaultCategoryIds.has(id) ? name : `Categoria personalizada ${index + 1}`;
  return {
    period: metrics.period,
    hasAccounts: metrics.hasAccounts,
    balance: formatBRL(metrics.balanceCents),
    plannedNext30Days: formatBRL(metrics.plannedNetNext30DaysCents),
    categories: metrics.categorySpend.map((item, index) => ({
      name: label(item.categoryId, item.name, index),
      current: formatBRL(item.currentCents),
      previous: formatBRL(item.previousCents),
    })),
    budgets: metrics.budgets.map((item, index) => ({
      name: label(item.categoryId, item.name, index),
      limit: formatBRL(item.limitCents),
      spent: formatBRL(item.spentCents),
    })),
    goals: metrics.goals.map((goal, index) => ({
      label: `Meta ${index + 1}`,
      remaining: formatBRL(goal.remainingCents),
      requiredPerMonth:
        goal.requiredMonthlyCents === null ? null : formatBRL(goal.requiredMonthlyCents),
      averagePerMonth: formatBRL(goal.averageMonthlyCents),
    })),
    insightTypes: insights.map((insight) => ({ type: insight.type, severity: insight.severity })),
  };
}

const MONEY_PATTERN = /-?R\$\s?-?[\d.]+(?:,\d{1,2})?/g;
const NUMBER_ONLY = /[^\d,]/g;

/**
 * Barreira contra valores inventados: todo valor em reais na resposta precisa existir nas
 * métricas enviadas. Se a resposta citar outro valor, é descartada em favor do fallback.
 */
export function outputUsesOnlyKnownValues(output: AssistantOutput, metrics: MinimizedMetrics): boolean {
  const known = new Set(
    (JSON.stringify(metrics).match(MONEY_PATTERN) ?? []).map((value) => value.replace(NUMBER_ONLY, "")),
  );
  const text = [output.title, output.summary, ...output.evidence, ...output.suggestedActions].join(" ");
  return (text.match(MONEY_PATTERN) ?? []).every((value) =>
    known.has(value.replace(NUMBER_ONLY, "")),
  );
}

function overview(insights: DeterministicInsight[], metrics: InsightMetrics): AssistantOutput {
  if (!metrics.hasAccounts) {
    return {
      title: "Ainda não há dados para analisar",
      summary: "Cadastre uma conta e registre alguns lançamentos para que eu possa analisar seus números.",
      evidence: [],
      suggestedActions: ["Crie sua primeira conta.", "Registre as transações mais recentes."],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  if (insights.length === 0) {
    return {
      title: "Nenhum ponto de atenção no momento",
      summary: `Seu saldo consolidado é de ${formatBRL(metrics.balanceCents)} e os dados atuais não dispararam nenhum alerta.`,
      evidence: [`Saldo consolidado: ${formatBRL(metrics.balanceCents)}`],
      suggestedActions: ["Continue registrando seus lançamentos para análises mais úteis."],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  return {
    title: `${insights.length} ponto(s) de atenção`,
    summary: insights.map((insight) => insight.summary).join(" "),
    evidence: insights.flatMap((insight) => insight.evidence.slice(0, 2)).slice(0, 10),
    suggestedActions: [...new Set(insights.flatMap((insight) => insight.suggestedActions))].slice(0, 5),
    disclaimer: ASSISTANT_DISCLAIMER,
  };
}

/** Respostas sem IA: só o que pode ser calculado. Fora disso, declara o limite. */
export function deterministicAnswer(
  question: string | undefined,
  metrics: InsightMetrics,
  insights: DeterministicInsight[],
): AssistantOutput {
  if (!question) return overview(insights, metrics);
  const text = question
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  if (/invest|acao|acoes|cdb|tesouro|fundo|cripto|bitcoin/.test(text)) {
    return {
      title: "Não indico investimentos específicos",
      summary:
        "Posso explicar conceitos como risco, liquidez e juros compostos na área Aprender, mas não recomendo produtos ou ativos.",
      evidence: [],
      suggestedActions: ["Consulte a seção Aprender e, se precisar, um profissional habilitado."],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  if (/saldo|quanto tenho/.test(text)) {
    return {
      title: "Seu saldo",
      summary: `O saldo consolidado realizado é de ${formatBRL(metrics.balanceCents)}.`,
      evidence: [`Previstos em 30 dias: ${formatBRL(metrics.plannedNetNext30DaysCents)}`],
      suggestedActions: [],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  if (/gast|despesa|categoria|economiz/.test(text)) {
    const sorted = [...metrics.categorySpend].sort((a, b) => b.currentCents - a.currentCents);
    if (sorted.length === 0) {
      return {
        title: "Sem despesas no período",
        summary: "Ainda não há despesas efetivadas neste período para analisar.",
        evidence: [],
        suggestedActions: ["Registre suas despesas para ver a distribuição por categoria."],
        disclaimer: ASSISTANT_DISCLAIMER,
      };
    }
    return {
      title: "Seus maiores gastos no período",
      summary: `A maior categoria é ${sorted[0].name}, com ${formatBRL(sorted[0].currentCents)}.`,
      evidence: sorted.slice(0, 5).map((item) => `${item.name}: ${formatBRL(item.currentCents)}`),
      suggestedActions: ["Revise os lançamentos das maiores categorias para achar gastos evitáveis."],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  if (/orcamento|limite/.test(text)) {
    return {
      title: "Seus orçamentos",
      summary:
        metrics.budgets.length > 0
          ? `Você tem ${metrics.budgets.length} orçamento(s) neste período.`
          : "Você ainda não definiu orçamentos neste período.",
      evidence: metrics.budgets.map(
        (item) => `${item.name}: ${formatBRL(item.spentCents)} de ${formatBRL(item.limitCents)}`,
      ),
      suggestedActions: [],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  if (/meta|objetivo/.test(text)) {
    return {
      title: "Suas metas",
      summary:
        metrics.goals.length > 0
          ? `Você tem ${metrics.goals.length} meta(s) ativa(s).`
          : "Você ainda não tem metas ativas.",
      evidence: metrics.goals.map((goal) => `${goal.title}: faltam ${formatBRL(goal.remainingCents)}`),
      suggestedActions: [],
      disclaimer: ASSISTANT_DISCLAIMER,
    };
  }
  return {
    title: "Não tenho dados para responder a isso",
    summary:
      "Sem a IA opcional, respondo sobre saldo, gastos por categoria, orçamentos e metas. Tente perguntar sobre um desses temas.",
    evidence: [],
    suggestedActions: [],
    disclaimer: ASSISTANT_DISCLAIMER,
  };
}
