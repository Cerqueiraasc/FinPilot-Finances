"use client";

import { Landmark, Plus } from "lucide-react";
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
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { AccountDTO } from "@/server/services/accounts";

const TYPE_LABEL = { CHECKING: "Conta corrente", SAVINGS: "Poupança", CASH: "Dinheiro" } as const;

function AccountForm({ initial, onDone }: { initial?: AccountDTO; onDone: () => void }) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = String(data.get("openingBalance") ?? "");
    const openingBalanceCents = raw.trim() === "" ? 0 : parseBRLToCents(raw);
    if (openingBalanceCents === null) {
      setFieldErrors({ openingBalanceCents: ["Informe um valor válido, como 1.000,00"] });
      return;
    }
    const body = {
      name: data.get("name"),
      type: data.get("type"),
      institution: data.get("institution"),
      openingBalanceCents,
    };
    const result = initial
      ? await submit("PATCH", `/api/accounts/${initial.id}`, body, { success: "Conta atualizada." })
      : await submit("POST", "/api/accounts", body, { success: "Conta criada." });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField label="Nome" name="name" required maxLength={60} defaultValue={initial?.name} errors={fieldErrors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Tipo" name="type" defaultValue={initial?.type ?? "CHECKING"} errors={fieldErrors.type}>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <MoneyField
          label="Saldo inicial (R$)"
          name="openingBalance"
          defaultValue={initial ? centsToInput(initial.openingBalanceCents) : undefined}
          errors={fieldErrors.openingBalanceCents}
        />
      </div>
      <TextField
        label="Instituição (opcional)"
        name="institution"
        maxLength={60}
        hint="Apenas um rótulo. Não há conexão com o banco."
        defaultValue={initial?.institution ?? ""}
        errors={fieldErrors.institution}
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

function AccountCard({ account }: { account: AccountDTO }) {
  const [editing, setEditing] = useState(false);
  const archive = useApiSubmit();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{account.name}</h2>
          <p className="truncate text-xs text-muted">
            {TYPE_LABEL[account.type]}
            {account.institution ? ` · ${account.institution}` : ""}
          </p>
        </div>
        {account.archived && <Badge>Arquivada</Badge>}
      </div>
      <Money cents={account.balanceCents} className="text-2xl font-extrabold tracking-tight" />
      <p className="text-xs text-muted">
        Saldo inicial <Money cents={account.openingBalanceCents} /> · {account.transactionCount} lançamento(s)
      </p>
      <FormError message={archive.formError} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={archive.pending}
          onClick={() =>
            archive.submit(
              "PATCH",
              `/api/accounts/${account.id}`,
              { archived: !account.archived },
              { success: account.archived ? "Conta reativada." : "Conta arquivada." },
            )
          }
        >
          {account.archived ? "Reativar" : "Arquivar"}
        </Button>
        {account.transactionCount === 0 && (
          <ConfirmButton
            label="Excluir"
            title="Excluir conta"
            description={`A conta "${account.name}" será removida. Não é possível desfazer.`}
            confirmLabel="Excluir"
            url={`/api/accounts/${account.id}`}
            success="Conta excluída."
          />
        )}
      </div>
      <Modal open={editing} title="Editar conta" onClose={() => setEditing(false)}>
        <AccountForm initial={account} onDone={() => setEditing(false)} />
      </Modal>
    </Card>
  );
}

export function AccountManager({ accounts }: { accounts: AccountDTO[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden className="size-4" /> Nova conta
        </Button>
      </div>
      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          description="Crie uma conta manual para começar a registrar seus lançamentos."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
      <Modal open={creating} title="Nova conta" onClose={() => setCreating(false)}>
        <AccountForm onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
