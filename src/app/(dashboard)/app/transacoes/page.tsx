import { ArrowLeftRight, FileUp, Repeat, Tags } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClasses } from "@/components/atoms/Button";
import { Callout, EmptyState, PageHeader } from "@/components/molecules/Feedback";
import { Pagination, TransactionFilters, TransactionTable } from "@/components/organisms/TransactionList";
import { transactionFiltersSchema } from "@/features/schemas";
import { requireUser } from "@/lib/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { listTransactions } from "@/server/services/transactions";

export const metadata = { title: "Transações" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user } = await requireUser();
  const params = await searchParams;
  const parsed = transactionFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : transactionFiltersSchema.parse({});
  const [result, accounts, categories] = await Promise.all([
    listTransactions(user.id, filters),
    listAccounts(user.id, { includeArchived: true }),
    listCategories(user.id),
  ]);
  const accountOptions = accounts.map(({ id, name }) => ({ id, name }));
  const categoryOptions = categories.map(({ id, name, type }) => ({ id, name, type }));
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <PageHeader
        title="Transações"
        description="Receitas, despesas e transferências."
        actions={
          <>
            <Link href="/app/transacoes/importar" className={buttonClasses("secondary", "sm")}>
              <FileUp aria-hidden className="size-4" /> Importar CSV
            </Link>
            <Link href="/app/transacoes/recorrencias" className={buttonClasses("secondary", "sm")}>
              <Repeat aria-hidden className="size-4" /> Recorrências
            </Link>
            <Link href="/app/transacoes/categorias" className={buttonClasses("secondary", "sm")}>
              <Tags aria-hidden className="size-4" /> Categorias
            </Link>
          </>
        }
      />
      <Suspense>
        <TransactionFilters accounts={accountOptions} categories={categoryOptions} />
      </Suspense>
      {!parsed.success && <Callout tone="warning">Alguns filtros eram inválidos e foram ignorados.</Callout>}
      {result.items.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={hasFilters ? "Nada encontrado" : "Nenhuma transação ainda"}
          description={
            hasFilters
              ? "Tente ajustar os filtros."
              : "Use o botão Adicionar transação no topo da página ou importe um extrato em CSV."
          }
        />
      ) : (
        <>
          <TransactionTable items={result.items} accounts={accountOptions} categories={categoryOptions} />
          <Suspense>
            <Pagination page={result.page} pageCount={result.pageCount} total={result.total} />
          </Suspense>
        </>
      )}
    </>
  );
}
