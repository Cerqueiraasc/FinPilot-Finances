"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { Callout } from "@/components/molecules/Feedback";
import { FormError, MoneyField, TextField } from "@/components/molecules/FormField";
import { compoundProjection } from "@/features/insights/education";
import { parseBRLToCents } from "@/lib/money";

export function CompoundSimulator() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof compoundProjection> | null>(null);
  const [rate, setRate] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const initial = parseBRLToCents(String(data.get("initial") || "0"));
    const monthly = parseBRLToCents(String(data.get("monthly") || "0"));
    const annualRate = Number(String(data.get("rate")).replace(",", "."));
    const years = Number(data.get("years"));
    if (
      initial === null ||
      monthly === null ||
      initial < 0 ||
      monthly < 0 ||
      !Number.isFinite(annualRate) ||
      annualRate < 0 ||
      annualRate > 100 ||
      !Number.isInteger(years) ||
      years < 1 ||
      years > 60
    ) {
      setResult(null);
      setError("Revise os valores: taxa de 0 a 100% ao ano e prazo de 1 a 60 anos.");
      return;
    }
    setError(null);
    setRate(String(data.get("rate")));
    setResult(compoundProjection(initial, monthly, annualRate, years));
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-bold">Simulador de juros compostos</h2>
        <p className="text-sm text-muted">Você informa a taxa. É um cenário hipotético, não uma previsão.</p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
        <MoneyField label="Valor inicial (R$)" name="initial" />
        <MoneyField label="Aporte mensal (R$)" name="monthly" />
        <TextField label="Taxa anual informada (%)" name="rate" inputMode="decimal" required />
        <TextField label="Prazo (anos)" name="years" type="number" min={1} max={60} required />
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="secondary">
            Calcular cenário
          </Button>
        </div>
      </form>
      <FormError message={error} />
      <div aria-live="polite">
        {result && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Valor hipotético final: <Money cents={result.finalCents} className="font-bold" />, sendo{" "}
              <Money cents={result.contributedCents} /> aportados e <Money cents={result.interestCents} /> de juros.
            </p>
            <Callout tone="info">
              Premissas: taxa constante de {rate}% ao ano, capitalização mensal, sem impostos, taxas ou inflação. Resultados reais podem ser diferentes, inclusive menores.
            </Callout>
          </div>
        )}
      </div>
    </Card>
  );
}
