"use client";

import { Plus, Target } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { EmptyState } from "@/components/molecules/Feedback";
import { FormError, MoneyField, SelectField, TextField, TextareaField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { formatDate, todayISO } from "@/lib/dates";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { GoalDTO } from "@/server/services/goals";

function GoalForm({ initial, onDone }: { initial?: GoalDTO; onDone: () => void }) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const targetCents = parseBRLToCents(String(data.get("target")));
    const rawInitial = String(data.get("initial") ?? "");
    const initialCents = rawInitial.trim() === "" ? 0 : parseBRLToCents(rawInitial);
    if (targetCents === null || targetCents <= 0) {
      setFieldErrors({ targetCents: ["Informe um valor-alvo maior que zero"] });
      return;
    }
    if (initialCents === null || initialCents < 0) {
      setFieldErrors({ initialCents: ["Informe um valor válido"] });
      return;
    }
    const body = {
      title: data.get("title"),
      description: data.get("description"),
      targetCents,
      initialCents,
      dueDate: String(data.get("dueDate") ?? "") || null,
      priority: Number(data.get("priority")),
    };
    const result = initial
      ? await submit("PATCH", `/api/goals/${initial.id}`, body, { success: "Meta atualizada." })
      : await submit("POST", "/api/goals", body, { success: "Meta criada." });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField label="Título" name="title" required maxLength={100} defaultValue={initial?.title} errors={fieldErrors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          label="Valor-alvo (R$)"
          name="target"
          required
          defaultValue={initial ? centsToInput(initial.targetCents) : undefined}
          errors={fieldErrors.targetCents}
        />
        <MoneyField
          label="Valor inicial (R$)"
          name="initial"
          defaultValue={initial ? centsToInput(initial.initialCents) : undefined}
          errors={fieldErrors.initialCents}
        />
        <TextField label="Prazo (opcional)" name="dueDate" type="date" defaultValue={initial?.dueDate ?? ""} errors={fieldErrors.dueDate} />
        <SelectField label="Prioridade" name="priority" defaultValue={initial?.priority ?? 2}>
          <option value={1}>Alta</option>
          <option value={2}>Média</option>
          <option value={3}>Baixa</option>
        </SelectField>
      </div>
      <TextareaField label="Descrição (opcional)" name="description" maxLength={500} defaultValue={initial?.description ?? ""} errors={fieldErrors.description} />
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

function ContributionForm({ goalId, onDone }: { goalId: string; onDone: () => void }) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents === 0) {
      setFieldErrors({ amountCents: ["Informe um valor. Use negativo para retirada."] });
      return;
    }
    const result = await submit(
      "POST",
      `/api/goals/${goalId}/contributions`,
      { amountCents, contributionDate: data.get("date"), note: data.get("note") },
      { success: "Aporte registrado." },
    );
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        O aporte é uma alocação virtual: não altera o saldo das contas nem conta como despesa.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField label="Valor (R$)" name="amount" required hint="Use negativo para retirada." errors={fieldErrors.amountCents} />
        <TextField label="Data" name="date" type="date" required defaultValue={todayISO()} errors={fieldErrors.contributionDate} />
      </div>
      <TextField label="Observação (opcional)" name="note" maxLength={200} errors={fieldErrors.note} />
      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Registrar
        </Button>
      </div>
    </form>
  );
}

function monthsLabel(months: number) {
  return months === 1 ? "1 mês" : `${months} meses`;
}

function GoalCard({ goal }: { goal: GoalDTO }) {
  const [mode, setMode] = useState<"edit" | "contribute" | null>(null);
  const status = useApiSubmit();
  const close = () => setMode(null);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 font-bold">{goal.title}</h2>
        {goal.status === "COMPLETED" && <Badge tone="positive">Concluída</Badge>}
        {goal.status === "ARCHIVED" && <Badge>Arquivada</Badge>}
      </div>
      {goal.description && <p className="text-sm text-muted">{goal.description}</p>}
      <ProgressBar percent={goal.percent} label={`Progresso de ${goal.title}`} />
      <p className="text-sm">
        <Money cents={goal.savedCents} className="font-bold" /> de <Money cents={goal.targetCents} /> ({goal.percent}%)
      </p>
      <dl className="grid gap-1 text-sm text-muted">
        <div className="flex justify-between gap-2">
          <dt>Faltam</dt>
          <dd className="font-semibold text-ink">
            <Money cents={goal.remainingCents} />
          </dd>
        </div>
        {goal.dueDate && (
          <div className="flex justify-between gap-2">
            <dt>Prazo</dt>
            <dd className="font-semibold text-ink">{formatDate(goal.dueDate)}</dd>
          </div>
        )}
        {goal.requiredMonthlyCents !== null && goal.remainingCents > 0 && (
          <div className="flex justify-between gap-2">
            <dt>Necessário por mês</dt>
            <dd className="font-semibold text-ink">
              <Money cents={goal.requiredMonthlyCents} />
            </dd>
          </div>
        )}
        {goal.remainingCents > 0 && (
          <div className="flex justify-between gap-2">
            <dt>Prazo estimado</dt>
            <dd className="font-semibold text-ink">
              {goal.estimatedMonths === null ? "Sem previsão" : monthsLabel(goal.estimatedMonths)}
            </dd>
          </div>
        )}
      </dl>
      {goal.remainingCents > 0 && (
        <p className="text-xs text-muted">Estimativa ilustrativa pela média dos aportes, sem considerar rendimento.</p>
      )}
      {goal.contributions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Aportes ({goal.contributions.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {goal.contributions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDate(item.date)} · <Money cents={item.amountCents} />
                  {item.note ? ` · ${item.note}` : ""}
                </span>
                <ConfirmButton
                  variant="ghost"
                  label="Remover"
                  title="Remover aporte"
                  description="O aporte será removido e o progresso da meta, recalculado."
                  confirmLabel="Remover"
                  url={`/api/goals/contributions/${item.id}`}
                  success="Aporte removido."
                />
              </li>
            ))}
          </ul>
        </details>
      )}
      <FormError message={status.formError} />
      <div className="flex flex-wrap gap-2">
        {goal.status === "ACTIVE" && (
          <Button size="sm" onClick={() => setMode("contribute")}>
            Registrar aporte
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>
          Editar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={status.pending}
          onClick={() =>
            status.submit(
              "PATCH",
              `/api/goals/${goal.id}`,
              { status: goal.status === "ACTIVE" ? "COMPLETED" : "ACTIVE" },
              { success: "Meta atualizada." },
            )
          }
        >
          {goal.status === "ACTIVE" ? "Concluir" : "Reativar"}
        </Button>
        <ConfirmButton
          label="Excluir"
          ariaLabel={`Excluir meta ${goal.title}`}
          title="Excluir meta"
          description={`A meta "${goal.title}" e seus aportes serão removidos. Não é possível desfazer.`}
          confirmLabel="Excluir"
          url={`/api/goals/${goal.id}`}
          success="Meta excluída."
        />
      </div>
      <Modal open={mode === "edit"} title="Editar meta" onClose={close}>
        <GoalForm initial={goal} onDone={close} />
      </Modal>
      <Modal open={mode === "contribute"} title={`Aporte em ${goal.title}`} onClose={close}>
        <ContributionForm goalId={goal.id} onDone={close} />
      </Modal>
    </Card>
  );
}

export function GoalManager({ goals }: { goals: GoalDTO[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden className="size-4" /> Nova meta
        </Button>
      </div>
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta ainda"
          description="Crie uma meta, como uma viagem ou reserva de emergência, e acompanhe quanto falta."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
      <Modal open={creating} title="Nova meta" onClose={() => setCreating(false)}>
        <GoalForm onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
