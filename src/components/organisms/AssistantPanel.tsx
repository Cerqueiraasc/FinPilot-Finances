"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, type Tone } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { EmptyState } from "@/components/molecules/Feedback";
import { FormError, TextField } from "@/components/molecules/FormField";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import type { AssistantResponse } from "@/features/insights/assistant";
import type { DeterministicInsight, InsightSeverity } from "@/features/insights/engine";

const SEVERITY: Record<InsightSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Importante", tone: "negative" },
  warning: { label: "Atenção", tone: "warning" },
  info: { label: "Informação", tone: "info" },
};

export function InsightList({ insights }: { insights: DeterministicInsight[] }) {
  if (insights.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Nenhum ponto de atenção agora"
        description="Quando seus dados indicarem algo relevante, como orçamento excedido ou meta atrasada, aparecerá aqui."
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {insights.map((insight) => (
        <li key={insight.dedupeKey}>
          <Card className="flex h-full flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 font-bold">{insight.title}</h3>
              <Badge tone={SEVERITY[insight.severity].tone}>{SEVERITY[insight.severity].label}</Badge>
            </div>
            <p className="text-sm">{insight.summary}</p>
            <ul className="list-disc pl-5 text-xs text-muted">
              {insight.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {insight.suggestedActions.map((action) => (
              <p key={action} className="text-sm font-medium">
                {action}
              </p>
            ))}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function AssistantPanel({ aiEnabled }: { aiEnabled: boolean }) {
  const { submit, pending, fieldErrors, formError } = useApiSubmit();
  const [answer, setAnswer] = useState<(AssistantResponse & { aiAvailable: boolean }) | null>(null);

  async function ask(question?: string) {
    const result = await submit<AssistantResponse & { aiAvailable: boolean }>(
      "POST",
      "/api/assistant/explain",
      question ? { question } : {},
      { refresh: false },
    );
    if (result.ok) setAnswer(result.data);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = String(new FormData(event.currentTarget).get("question") ?? "").trim();
    void ask(question || undefined);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-bold">Pergunte sobre seus dados</h2>
        <p className="text-sm text-muted">
          {aiEnabled ? (
            "IA opcional ativada: recebe apenas números agregados, sem descrições de lançamentos."
          ) : (
            <>
              Respostas calculadas diretamente dos seus dados, sem IA. Você pode ativar a IA em{" "}
              <Link href="/app/configuracoes" className="font-semibold text-accent underline">
                Configurações
              </Link>
              .
            </>
          )}
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <div className="min-w-0 flex-1">
          <TextField
            label="Sua pergunta"
            name="question"
            maxLength={500}
            placeholder="Ex.: Em que categoria gastei mais?"
            errors={fieldErrors.question}
          />
        </div>
        <Button type="submit" loading={pending}>
          Perguntar
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => ask()}>
          Explicar o período
        </Button>
      </form>
      <FormError message={formError} />
      <div aria-live="polite">
        {answer && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{answer.title}</h3>
              <Badge tone={answer.source === "ai" ? "info" : "neutral"}>
                {answer.source === "ai" ? "Gerado por IA" : "Calculado dos seus dados"}
              </Badge>
            </div>
            <p className="text-sm">{answer.summary}</p>
            {answer.evidence.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted">
                {answer.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {answer.suggestedActions.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {answer.suggestedActions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">{answer.disclaimer}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
