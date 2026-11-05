"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { FormError, MoneyField, SelectField, TextField, TextareaField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { apiRequest } from "@/lib/api/client";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { todayISO } from "@/lib/dates";
import { centsToInput, parseBRLToCents } from "@/lib/money";

export interface AccountOption {
  id: string;
  name: string;
}
export interface CategoryOption {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}
export interface TransactionInitial {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: "INCOME" | "EXPENSE" | "REFUND";
  amountCents: number;
  description: string;
  transactionDate: string;
  status: "PENDING" | "POSTED" | "CANCELED";
  notes: string | null;
  tags: string[];
  recurring: boolean;
}

export function TransactionForm({
  accounts,
  categories,
  initial,
  onDone,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  initial?: TransactionInitial;
  onDone: () => void;
}) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "REFUND">(initial?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [suggested, setSuggested] = useState(false);
  const [date, setDate] = useState(initial?.transactionDate ?? todayISO());
  const isFuture = date > todayISO();
  const options = categories.filter(
    (category) => category.type === (type === "INCOME" ? "INCOME" : "EXPENSE"),
  );

  async function suggestCategory(description: string) {
    if (categoryId || description.trim().length < 3) return;
    const result = await apiRequest<{ categoryId: string | null }>(
      "POST",
      "/api/category-rules/suggest",
      { description, type },
    );
    if (result.ok && result.data.categoryId) {
      setCategoryId(result.data.categoryId);
      setSuggested(true);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents <= 0) {
      setFieldErrors({ amountCents: ["Informe um valor maior que zero, como 125,90"] });
      return;
    }
    const status = isFuture ? "PENDING" : String(data.get("status") ?? "POSTED");
    const body = {
      accountId: data.get("accountId"),
      categoryId: categoryId || null,
      type,
      amountCents,
      description: data.get("description"),
      transactionDate: date,
      status,
      notes: data.get("notes"),
      tags: String(data.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    const result = initial
      ? await submit("PATCH", `/api/transactions/${initial.id}`, body, { success: "Transação atualizada." })
      : await submit("POST", "/api/transactions", body, { success: "Transação registrada." });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {initial?.recurring && (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-sm font-medium text-info">
          Esta edição vale só para esta ocorrência. Para mudar a série, use Recorrências.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          value={type}
          onChange={(event) => {
            setType(event.target.value as typeof type);
            setCategoryId("");
            setSuggested(false);
          }}
        >
          <option value="EXPENSE">Despesa</option>
          <option value="INCOME">Receita</option>
          <option value="REFUND">Estorno ou reembolso</option>
        </SelectField>
        <MoneyField
          label="Valor (R$)"
          name="amount"
          required
          defaultValue={initial ? centsToInput(initial.amountCents) : undefined}
          errors={fieldErrors.amountCents}
        />
      </div>
      <TextField
        label="Descrição"
        name="description"
        required
        maxLength={200}
        defaultValue={initial?.description}
        onBlur={(event) => suggestCategory(event.target.value)}
        errors={fieldErrors.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Conta"
          name="accountId"
          required
          defaultValue={initial?.accountId}
          errors={fieldErrors.accountId}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Categoria"
          value={categoryId}
          hint={suggested ? "Sugestão automática. Você pode trocar." : undefined}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setSuggested(false);
          }}
          errors={fieldErrors.categoryId}
        >
          <option value="">Sem categoria</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Data"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          errors={fieldErrors.transactionDate}
        />
        <SelectField
          label="Situação"
          name="status"
          key={String(isFuture)}
          defaultValue={isFuture ? "PENDING" : (initial?.status ?? "POSTED")}
          disabled={isFuture}
          hint={isFuture ? "Data futura fica como prevista e não altera o saldo." : undefined}
          errors={fieldErrors.status}
        >
          <option value="POSTED">Efetivada</option>
          <option value="PENDING">Prevista</option>
          {initial && <option value="CANCELED">Cancelada</option>}
        </SelectField>
      </div>
      <TextField
        label="Tags"
        name="tags"
        hint="Separe por vírgulas."
        defaultValue={initial?.tags.join(", ")}
        errors={fieldErrors.tags}
      />
      <TextareaField label="Observações" name="notes" maxLength={500} defaultValue={initial?.notes ?? ""} errors={fieldErrors.notes} />
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

export interface TransferInitial {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  transferDate: string;
  description: string;
}

export function TransferForm({
  accounts,
  initial,
  onDone,
}: {
  accounts: AccountOption[];
  initial?: TransferInitial;
  onDone: () => void;
}) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountCents = parseBRLToCents(String(data.get("amount")));
    if (amountCents === null || amountCents <= 0) {
      setFieldErrors({ amountCents: ["Informe um valor maior que zero, como 300,00"] });
      return;
    }
    const body = {
      fromAccountId: data.get("fromAccountId"),
      toAccountId: data.get("toAccountId"),
      amountCents,
      transferDate: data.get("transferDate"),
      description: String(data.get("description") || "Transferência entre contas"),
    };
    const result = initial
      ? await submit("PATCH", `/api/transfers/${initial.id}`, body, { success: "Transferência atualizada." })
      : await submit("POST", "/api/transfers", body, { success: "Transferência registrada." });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">Transferências não contam como receita nem como despesa.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="De" name="fromAccountId" defaultValue={initial?.fromAccountId ?? accounts[0]?.id} errors={fieldErrors.fromAccountId}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Para" name="toAccountId" defaultValue={initial?.toAccountId ?? accounts[1]?.id} errors={fieldErrors.toAccountId}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <MoneyField
          label="Valor (R$)"
          name="amount"
          required
          defaultValue={initial ? centsToInput(initial.amountCents) : undefined}
          errors={fieldErrors.amountCents}
        />
        <TextField
          label="Data"
          name="transferDate"
          type="date"
          required
          defaultValue={initial?.transferDate ?? todayISO()}
          errors={fieldErrors.transferDate}
        />
      </div>
      <TextField label="Descrição" name="description" maxLength={200} defaultValue={initial?.description} errors={fieldErrors.description} />
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

/** CTA global "Adicionar transação". */
export function QuickAdd({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [mode, setMode] = useState<"transaction" | "transfer" | null>(null);
  const close = () => setMode(null);
  const noAccounts = accounts.length === 0;
  return (
    <>
      <Button onClick={() => setMode("transaction")}>
        <Plus aria-hidden className="size-4" />
        <span>
          Adicionar<span className="max-sm:hidden"> transação</span>
        </span>
      </Button>
      <Modal open={mode !== null} title={mode === "transfer" ? "Nova transferência" : "Nova transação"} onClose={close}>
        {noAccounts ? (
          <p className="text-sm text-muted">Crie uma conta em Contas antes de registrar transações.</p>
        ) : mode === "transfer" ? (
          <TransferForm accounts={accounts} onDone={close} />
        ) : (
          <div className="flex flex-col gap-4">
            {accounts.length > 1 && (
              <Button variant="secondary" size="sm" className="self-start" onClick={() => setMode("transfer")}>
                É uma transferência entre contas?
              </Button>
            )}
            <TransactionForm accounts={accounts} categories={categories} onDone={close} />
          </div>
        )}
      </Modal>
    </>
  );
}
