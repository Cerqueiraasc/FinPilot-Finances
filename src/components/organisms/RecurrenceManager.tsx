"use client";

import { Plus, Repeat } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { EmptyState } from "@/components/molecules/Feedback";
import { FormError, MoneyField, SelectField, TextField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { formatDate, todayISO } from "@/lib/dates";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { AccountOption, CategoryOption } from "./TransactionForms";

interface RecurrenceDTO {
  id: string;
  accountName: string;
  categoryName: string | null;
  type: string;
  amountCents: number;
  description: string;
  cadence: "WEEKLY" | "MONTHLY" | "YEARLY";
  nextRunAt: string;
  endDate: string | null;
  active: boolean;
}

const CADENCE = { WEEKLY: "Semanal", MONTHLY: "Mensal", YEARLY: "Anual" } as const;

function CreateForm({
  accounts,
  categories,
  onDone,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents <= 0) {
      setFieldErrors({ amountCents: ["Informe um valor maior que zero"] });
      return;
    }
    const result = await submit(
      "POST",
      "/api/recurrences",
      {
        accountId: data.get("accountId"),
        categoryId: String(data.get("categoryId") ?? "") || null,
        type,
        amountCents,
        description: data.get("description"),
        cadence: data.get("cadence"),
        startDate: data.get("startDate"),
        endDate: String(data.get("endDate") ?? "") || null,
      },
      { success: "Recorrência criada." },
    );
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField label="Descrição" name="description" required maxLength={200} errors={fieldErrors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Tipo" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="EXPENSE">Despesa</option>
          <option value="INCOME">Receita</option>
        </SelectField>
        <MoneyField label="Valor (R$)" name="amount" required errors={fieldErrors.amountCents} />
        <SelectField label="Conta" name="accountId" errors={fieldErrors.accountId}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Categoria" name="categoryId" key={type} errors={fieldErrors.categoryId}>
          <option value="">Sem categoria</option>
          {categories
            .filter((category) => category.type === type)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </SelectField>
        <SelectField label="Frequência" name="cadence" defaultValue="MONTHLY">
          {Object.entries(CADENCE).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField label="Início" name="startDate" type="date" required defaultValue={todayISO()} errors={fieldErrors.startDate} />
        <TextField label="Fim (opcional)" name="endDate" type="date" errors={fieldErrors.endDate} />
      </div>
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

function EditSeriesForm({ rule, onDone }: { rule: RecurrenceDTO; onDone: () => void }) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents <= 0) {
      setFieldErrors({ amountCents: ["Informe um valor maior que zero"] });
      return;
    }
    const result = await submit(
      "PATCH",
      `/api/recurrences/${rule.id}`,
      { amountCents, description: data.get("description") },
      { success: "Série atualizada." },
    );
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Vale para as próximas ocorrências. As passadas e as editadas individualmente não mudam.
      </p>
      <TextField label="Descrição" name="description" required maxLength={200} defaultValue={rule.description} errors={fieldErrors.description} />
      <MoneyField label="Valor (R$)" name="amount" required defaultValue={centsToInput(rule.amountCents)} errors={fieldErrors.amountCents} />
      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar série
        </Button>
      </div>
    </form>
  );
}

function RecurrenceRow({ rule }: { rule: RecurrenceDTO }) {
  const [editing, setEditing] = useState(false);
  const toggle = useApiSubmit();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{rule.description}</h2>
          <p className="text-xs text-muted">
            {CADENCE[rule.cadence]} · {rule.accountName} · {rule.categoryName ?? "Sem categoria"}
          </p>
        </div>
        <Badge tone={rule.active ? "positive" : "neutral"}>{rule.active ? "Ativa" : "Pausada"}</Badge>
      </div>
      <p className="text-sm">
        <Money cents={rule.amountCents} className="font-bold" />
        {rule.active && <span className="text-muted"> · próxima geração em {formatDate(rule.nextRunAt)}</span>}
        {rule.endDate && <span className="text-muted"> · termina em {formatDate(rule.endDate)}</span>}
      </p>
      <FormError message={toggle.formError} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Editar série
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={toggle.pending}
          onClick={() =>
            toggle.submit(
              "PATCH",
              `/api/recurrences/${rule.id}`,
              { active: !rule.active },
              { success: rule.active ? "Série pausada." : "Série reativada." },
            )
          }
        >
          {rule.active ? "Pausar" : "Reativar"}
        </Button>
        <ConfirmButton
          label="Excluir"
          ariaLabel={`Excluir recorrência ${rule.description}`}
          title="Excluir recorrência"
          description="As próximas ocorrências serão canceladas. Os lançamentos já efetivados continuam no histórico."
          confirmLabel="Excluir"
          url={`/api/recurrences/${rule.id}`}
          success="Recorrência excluída."
        />
      </div>
      <Modal open={editing} title="Editar série" onClose={() => setEditing(false)}>
        <EditSeriesForm rule={rule} onDone={() => setEditing(false)} />
      </Modal>
    </Card>
  );
}

export function RecurrenceManager({
  rules,
  accounts,
  categories,
}: {
  rules: RecurrenceDTO[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button disabled={accounts.length === 0} onClick={() => setCreating(true)}>
          <Plus aria-hidden className="size-4" /> Nova recorrência
        </Button>
      </div>
      {rules.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nenhuma recorrência"
          description="Cadastre salário, aluguel e assinaturas para vê-los nas projeções."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <RecurrenceRow key={rule.id} rule={rule} />
          ))}
        </div>
      )}
      <Modal open={creating} title="Nova recorrência" onClose={() => setCreating(false)}>
        <CreateForm accounts={accounts} categories={categories} onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
