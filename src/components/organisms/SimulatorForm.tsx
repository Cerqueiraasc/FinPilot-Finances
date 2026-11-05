"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { Callout } from "@/components/molecules/Feedback";
import { FormError, MoneyField, SelectField, TextField } from "@/components/molecules/FormField";
import { StatCard } from "@/components/molecules/StatCard";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { todayISO } from "@/lib/dates";
import { parseBRLToCents } from "@/lib/money";
import type { SimulationOutcome } from "@/features/simulator/calculations";
import type { CategoryOption } from "./TransactionForms";

export function SimulatorForm({ categories }: { categories: CategoryOption[] }) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents <= 0) {
      setFieldErrors({ amountCents: ["Informe um valor maior que zero"] });
      return;
    }
    const result = await submit<SimulationOutcome>(
      "POST",
      "/api/simulations/purchase",
      {
        amountCents,
        categoryId: data.get("categoryId"),
        plannedDate: data.get("plannedDate"),
        essential: data.get("nature") === "essential",
        note: data.get("note"),
      },
      { refresh: false },
    );
    if (result.ok) setOutcome(result.data);
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <MoneyField label="Valor da compra (R$)" name="amount" required errors={fieldErrors.amountCents} />
          <SelectField label="Categoria" name="categoryId" errors={fieldErrors.categoryId}>
            {categories
              .filter((category) => category.type === "EXPENSE")
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </SelectField>
          <SelectField label="Forma de pagamento" name="payment" disabled defaultValue="cash" hint="Nesta versão, somente à vista.">
            <option value="cash">À vista</option>
          </SelectField>
          <TextField label="Data planejada" name="plannedDate" type="date" required defaultValue={todayISO()} errors={fieldErrors.plannedDate} />
          <SelectField label="Natureza" name="nature" defaultValue="optional">
            <option value="optional">Opcional</option>
            <option value="essential">Essencial</option>
          </SelectField>
          <TextField label="Observação (opcional)" name="note" maxLength={200} hint="Não é salva." errors={fieldErrors.note} />
          <FormError message={formError} />
          <Button type="submit" loading={pending}>
            Simular
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-4" aria-live="polite">
        {!outcome && (
          <Card>
            <p className="text-sm text-muted">
              Preencha a compra para ver o impacto no saldo, no orçamento e nas metas. A simulação não autoriza nem bloqueia compras.
            </p>
          </Card>
        )}
        {outcome && !outcome.sufficient && <Callout tone="info">{outcome.reason}</Callout>}
        {outcome?.sufficient && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Saldo projetado" value={<Money cents={outcome.projectedBalanceCents} />} detail="Depois da compra e dos previstos" />
              <StatCard label="Margem" value={<Money cents={outcome.marginCents} />} detail="Saldo projetado menos a reserva mínima" />
            </div>
            <Card className="flex flex-col gap-2">
              <h2 className="font-bold">O que isso significa</h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {outcome.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
            {outcome.goalImpacts.length > 0 && (
              <Card className="flex flex-col gap-2">
                <h2 className="font-bold">Impacto nas metas</h2>
                <ul className="flex flex-col gap-2 text-sm">
                  {outcome.goalImpacts.map((goal) => (
                    <li key={goal.title}>
                      <strong>{goal.title}:</strong> {goal.message}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card className="flex flex-col gap-2 bg-surface-2">
              <h2 className="text-sm font-bold">Premissas</h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted">
                {outcome.assumptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
