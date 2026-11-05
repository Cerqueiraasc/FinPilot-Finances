"use client";

import { ChevronLeft, ChevronRight, PiggyBank, Plus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { BudgetMeter } from "@/components/molecules/BudgetMeter";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { EmptyState } from "@/components/molecules/Feedback";
import { FormError, MoneyField, SelectField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { longMonthLabel } from "@/lib/dates";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { BudgetDTO } from "@/server/services/budgets";
import type { CategoryOption } from "./TransactionForms";

function BudgetForm({
  year,
  month,
  categories,
  initial,
  onDone,
}: {
  year: number;
  month: number;
  categories: CategoryOption[];
  initial?: BudgetDTO;
  onDone: () => void;
}) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const limitCents = parseBRLToCents(String(data.get("limit")));
    if (limitCents === null || limitCents <= 0) {
      setFieldErrors({ limitCents: ["Informe um limite maior que zero"] });
      return;
    }
    const result = initial
      ? await submit("PATCH", `/api/budgets/${initial.id}`, { limitCents }, { success: "Orçamento atualizado." })
      : await submit(
          "POST",
          "/api/budgets",
          { categoryId: data.get("categoryId"), year, month, limitCents },
          { success: "Orçamento criado." },
        );
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {!initial && (
        <SelectField label="Categoria" name="categoryId" errors={fieldErrors.categoryId}>
          {categories
            .filter((category) => category.type === "EXPENSE")
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </SelectField>
      )}
      <MoneyField
        label="Limite do mês (R$)"
        name="limit"
        required
        defaultValue={initial ? centsToInput(initial.limitCents) : undefined}
        errors={fieldErrors.limitCents}
      />
      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

export function BudgetManager({
  budgets,
  categories,
  year,
  month,
}: {
  budgets: BudgetDTO[];
  categories: CategoryOption[];
  year: number;
  month: number;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BudgetDTO | null>(null);
  const shift = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    return `?ano=${Math.floor(index / 12)}&mes=${(index % 12) + 1}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={shift(-1)} aria-label="Mês anterior" className={buttonClasses("ghost", "sm")}>
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <p className="min-w-40 text-center font-bold first-letter:uppercase" aria-live="polite">
            {longMonthLabel(year, month)}
          </p>
          <Link href={shift(1)} aria-label="Próximo mês" className={buttonClasses("ghost", "sm")}>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden className="size-4" /> Novo orçamento
        </Button>
      </div>
      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sem orçamentos neste mês"
          description="Defina limites por categoria para receber alertas em 80%, 100% e ao ultrapassar."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => (
            <Card key={budget.id} className="flex flex-col gap-3">
              <BudgetMeter
                name={budget.categoryName}
                spentCents={budget.spentCents}
                limitCents={budget.limitCents}
                percent={budget.percent}
                level={budget.level}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(budget)}>
                  Editar limite
                </Button>
                <ConfirmButton
                  label="Excluir"
                  ariaLabel={`Excluir orçamento de ${budget.categoryName}`}
                  title="Excluir orçamento"
                  description={`O orçamento de ${budget.categoryName} será removido. Os lançamentos não mudam.`}
                  confirmLabel="Excluir"
                  url={`/api/budgets/${budget.id}`}
                  success="Orçamento excluído."
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={creating} title="Novo orçamento" onClose={() => setCreating(false)}>
        <BudgetForm year={year} month={month} categories={categories} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={editing !== null} title="Editar limite" onClose={() => setEditing(null)}>
        {editing && (
          <BudgetForm
            year={year}
            month={month}
            categories={categories}
            initial={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
