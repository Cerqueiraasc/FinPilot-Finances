"use client";

import { ChevronLeft, ChevronRight, Pencil, Repeat } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, type Tone } from "@/components/atoms/Badge";
import { Button, buttonClasses } from "@/components/atoms/Button";
import { Money } from "@/components/atoms/Money";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { SelectField, TextField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { apiRequest } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { balanceEffect } from "@/features/transactions/calculations";
import type { TransactionDTO } from "@/server/services/transactions";
import {
  TransactionForm,
  TransferForm,
  type AccountOption,
  type CategoryOption,
  type TransferInitial,
} from "./TransactionForms";

const STATUS: Record<TransactionDTO["status"], { label: string; tone: Tone }> = {
  POSTED: { label: "Efetivada", tone: "neutral" },
  PENDING: { label: "Prevista", tone: "info" },
  CANCELED: { label: "Cancelada", tone: "warning" },
};

function TransactionActions({
  item,
  accounts,
  categories,
}: {
  item: TransactionDTO;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [transfer, setTransfer] = useState<TransferInitial | null>(null);
  const isTransfer = item.transferId !== null;

  async function openEditor() {
    if (isTransfer) {
      const result = await apiRequest<TransferInitial>("GET", `/api/transfers/${item.transferId}`);
      if (result.ok) setTransfer(result.data);
    }
    setEditing(true);
  }
  const close = () => setEditing(false);

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" aria-label={`Editar ${item.description}`} onClick={openEditor}>
        <Pencil aria-hidden className="size-4" />
      </Button>
      <ConfirmButton
        variant="ghost"
        label="Excluir"
        ariaLabel={`Excluir ${item.description}`}
        title={isTransfer ? "Excluir transferência" : "Excluir transação"}
        description={
          isTransfer
            ? "As duas pernas da transferência serão removidas e os saldos das contas, recalculados."
            : item.recurrenceRuleId
              ? "Esta ocorrência será cancelada. A série continua ativa."
              : "A transação será removida e os saldos, recalculados. Não é possível desfazer."
        }
        confirmLabel="Excluir"
        url={isTransfer ? `/api/transfers/${item.transferId}` : `/api/transactions/${item.id}`}
        success="Registro excluído."
      />
      <Modal open={editing} title={isTransfer ? "Editar transferência" : "Editar transação"} onClose={close}>
        {isTransfer ? (
          transfer && <TransferForm accounts={accounts} initial={transfer} onDone={close} />
        ) : (
          <TransactionForm
            accounts={accounts}
            categories={categories}
            initial={{
              id: item.id,
              accountId: item.accountId,
              categoryId: item.categoryId,
              type: item.type as "INCOME" | "EXPENSE" | "REFUND",
              amountCents: item.amountCents,
              description: item.description,
              transactionDate: item.transactionDate,
              status: item.status,
              notes: item.notes,
              tags: item.tags,
              recurring: item.recurrenceRuleId !== null,
            }}
            onDone={close}
          />
        )}
      </Modal>
    </div>
  );
}

export function TransactionTable({
  items,
  accounts,
  categories,
}: {
  items: TransactionDTO[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {items.map((item) => {
        const signed = balanceEffect(item.type, item.amountCents);
        const status = STATUS[item.status];
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:px-4">
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex items-center gap-1.5 truncate font-semibold">
                {item.recurrenceRuleId && (
                  <Repeat aria-label="Recorrente" className="size-3.5 shrink-0 text-muted" />
                )}
                <span className="truncate">{item.description}</span>
              </p>
              <p className="truncate text-xs text-muted">
                {formatDate(item.transactionDate)} · {item.accountName}
                {item.transferId
                  ? " · Transferência"
                  : ` · ${item.categoryName ?? "Sem categoria"}`}
                {item.type === "REFUND" && " · Estorno"}
              </p>
              {item.tags.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {item.status !== "POSTED" && <Badge tone={status.tone}>{status.label}</Badge>}
              <Money
                cents={signed}
                signed={item.type === "INCOME" || item.type === "REFUND"}
                className={
                  item.status === "CANCELED" ? "font-bold line-through opacity-60" : "font-bold"
                }
              />
            </div>
            <TransactionActions item={item} accounts={accounts} categories={categories} />
          </li>
        );
      })}
    </ul>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const hrefFor = (target: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(target));
    return `${pathname}?${next.toString()}`;
  };
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Página {page} de {pageCount} · {total} {total === 1 ? "lançamento" : "lançamentos"}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className={buttonClasses("secondary", "sm")}>
            <ChevronLeft aria-hidden className="size-4" /> Anterior
          </Link>
        )}
        {page < pageCount && (
          <Link href={hrefFor(page + 1)} className={buttonClasses("secondary", "sm")}>
            Próxima <ChevronRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}

export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const value = (key: string) => params.get(key) ?? "";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    new FormData(event.currentTarget).forEach((entry, key) => {
      if (typeof entry === "string" && entry) next.set(key, entry);
    });
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form
      key={params.toString()}
      onSubmit={onSubmit}
      className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div className="col-span-2 sm:col-span-3 lg:col-span-2">
        <TextField label="Buscar" name="search" type="search" defaultValue={value("search")} placeholder="Descrição, nota ou tag" />
      </div>
      <TextField label="De" name="from" type="date" defaultValue={value("from")} />
      <TextField label="Até" name="to" type="date" defaultValue={value("to")} />
      <SelectField label="Conta" name="accountId" defaultValue={value("accountId")}>
        <option value="">Todas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Categoria" name="categoryId" defaultValue={value("categoryId")}>
        <option value="">Todas</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} ({category.type === "INCOME" ? "receita" : "despesa"})
          </option>
        ))}
      </SelectField>
      <SelectField label="Tipo" name="type" defaultValue={value("type")}>
        <option value="">Todos</option>
        <option value="EXPENSE">Despesa</option>
        <option value="INCOME">Receita</option>
        <option value="REFUND">Estorno</option>
        <option value="TRANSFER">Transferência</option>
      </SelectField>
      <SelectField label="Situação" name="status" defaultValue={value("status")}>
        <option value="">Todas</option>
        <option value="POSTED">Efetivada</option>
        <option value="PENDING">Prevista</option>
        <option value="CANCELED">Cancelada</option>
      </SelectField>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-1 lg:col-span-2">
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {params.size > 0 && (
          <Link href={pathname} className={buttonClasses("ghost")}>
            Limpar
          </Link>
        )}
      </div>
    </form>
  );
}
