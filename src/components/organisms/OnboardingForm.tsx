"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { FormError, MoneyField, TextField } from "@/components/molecules/FormField";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { parseBRLToCents } from "@/lib/money";

export function OnboardingForm() {
  const router = useRouter();
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optional = (name: string) => {
      const text = String(data.get(name) ?? "").trim();
      return text ? parseBRLToCents(text) : null;
    };
    const opening = String(data.get("opening") ?? "").trim();
    const openingBalanceCents = opening ? parseBRLToCents(opening) : 0;
    if (openingBalanceCents === null) {
      setFieldErrors({ openingBalanceCents: ["Informe um valor válido, como 1.000,00"] });
      return;
    }
    const goalTitle = String(data.get("goalTitle") ?? "").trim();
    const goalTargetCents = optional("goalTarget");
    if (goalTitle && (goalTargetCents === null || goalTargetCents <= 0)) {
      setFieldErrors({ goalTargetCents: ["Informe o valor-alvo da meta"] });
      return;
    }
    const result = await submit(
      "POST",
      "/api/onboarding",
      {
        financialMonthStartDay: Number(data.get("startDay") || 1),
        estimatedIncomeCents: optional("income"),
        minReserveCents: optional("reserve"),
        accountName: data.get("accountName"),
        openingBalanceCents,
        goalTitle,
        goalTargetCents,
      },
      { refresh: false },
    );
    if (result.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-bold">Sua primeira conta</legend>
        <TextField label="Nome da conta" name="accountName" defaultValue="Conta corrente" maxLength={60} errors={fieldErrors.accountName} />
        <MoneyField label="Saldo atual (R$)" name="opening" errors={fieldErrors.openingBalanceCents} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-bold">Seu mês financeiro</legend>
        <TextField
          label="Dia de início do mês"
          name="startDay"
          type="number"
          min={1}
          max={28}
          defaultValue={1}
          hint="Por exemplo, o dia em que você recebe."
          errors={fieldErrors.financialMonthStartDay}
        />
        <MoneyField label="Renda estimada (opcional)" name="income" errors={fieldErrors.estimatedIncomeCents} />
        <MoneyField
          label="Reserva mínima (opcional)"
          name="reserve"
          hint="Quanto você prefere manter sempre disponível."
          errors={fieldErrors.minReserveCents}
        />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-bold">Uma meta (opcional)</legend>
        <TextField label="Título" name="goalTitle" maxLength={100} errors={fieldErrors.goalTitle} />
        <MoneyField label="Valor-alvo (R$)" name="goalTarget" errors={fieldErrors.goalTargetCents} />
      </fieldset>
      <p className="text-sm text-muted">Moeda: real brasileiro (BRL). As categorias padrão já estão prontas.</p>
      <FormError message={formError} />
      <Button type="submit" loading={pending} className="self-start">
        Começar
      </Button>
    </form>
  );
}
