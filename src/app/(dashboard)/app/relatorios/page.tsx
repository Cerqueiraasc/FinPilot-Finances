import { Download } from "lucide-react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { PageHeader } from "@/components/molecules/Feedback";
import { SelectField, TextField } from "@/components/molecules/FormField";
import { StatCard } from "@/components/molecules/StatCard";
import { CategoryChart } from "@/components/organisms/Charts";
import { reportFiltersSchema } from "@/features/schemas";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDate, periodForDate, todayISO } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { getReport } from "@/server/services/reports";

export const metadata = { title: "Relatórios" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user } = await requireUser();
  const params = await searchParams;
  const period = periodForDate(todayISO(), user.financialMonthStartDay);
  const parsed = reportFiltersSchema.safeParse({
    from: params.from || period.from,
    to: params.to || addDays(period.toExclusive, -1),
    accountId: params.accountId || undefined,
    categoryId: params.categoryId || undefined,
  });
  const filters = parsed.success
    ? parsed.data
    : { from: period.from, to: addDays(period.toExclusive, -1) };

  const [accounts, categories] = await Promise.all([
    listAccounts(user.id, { includeArchived: true }),
    listCategories(user.id),
  ]);
  const report = await getReport(user.id, filters).catch((error) => {
    // Filtro com conta alheia ou inexistente volta ao relatório sem esse filtro.
    if (error instanceof AppError && error.status === 404) {
      return getReport(user.id, { from: filters.from, to: filters.to });
    }
    throw error;
  });

  const query = new URLSearchParams(
    Object.entries({ ...filters, format: "csv" }).filter(([, value]) => Boolean(value)) as [string, string][],
  );

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`De ${formatDate(filters.from)} a ${formatDate(filters.to)}.`}
        actions={
          <a href={`/api/reports/export?${query.toString()}`} className={buttonClasses("secondary", "sm")}>
            <Download aria-hidden className="size-4" /> Exportar CSV
          </a>
        }
      />
      <form className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3 lg:grid-cols-5">
        <TextField label="De" name="from" type="date" defaultValue={filters.from} />
        <TextField label="Até" name="to" type="date" defaultValue={filters.to} />
        <SelectField label="Conta" name="accountId" defaultValue={filters.accountId ?? ""}>
          <option value="">Todas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Categoria" name="categoryId" defaultValue={filters.categoryId ?? ""}>
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.type === "INCOME" ? "receita" : "despesa"})
            </option>
          ))}
        </SelectField>
        <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
          <Link href="/app/relatorios" className={buttonClasses("ghost")}>
            Limpar
          </Link>
        </div>
      </form>
      <section aria-label="Totais do período" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receitas" value={<Money cents={report.summary.incomeCents} />} detail="Efetivadas" />
        <StatCard label="Despesas" value={<Money cents={report.summary.expenseCents} />} detail="Líquidas de estornos" />
        <StatCard label="Economia líquida" value={<Money cents={report.summary.netCents} />} detail="Sem transferências" />
        <StatCard
          label="Taxa de poupança"
          value={report.summary.savingsRate === null ? "N/D" : `${report.summary.savingsRate.toLocaleString("pt-BR")}%`}
          detail={`${report.transactionCount} lançamento(s)`}
        />
      </section>
      {report.categories.length > 0 ? (
        <CategoryChart data={report.categories} />
      ) : (
        <Card>
          <p className="text-sm text-muted">Sem despesas efetivadas para os filtros escolhidos.</p>
        </Card>
      )}
    </>
  );
}
