import { PageHeader } from "@/components/molecules/Feedback";
import { BudgetManager } from "@/components/organisms/BudgetManager";
import { BudgetChart } from "@/components/organisms/Charts";
import { requireUser } from "@/lib/auth/session";
import { periodForDate, todayISO } from "@/lib/dates";
import { listBudgets } from "@/server/services/budgets";
import { listCategories } from "@/server/services/categories";

export const metadata = { title: "Orçamentos" };

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { user } = await requireUser();
  const params = await searchParams;
  const current = periodForDate(todayISO(), user.financialMonthStartDay);
  const parsedYear = Number(params.ano);
  const parsedMonth = Number(params.mes);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : current.year;
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : current.month;
  const [budgets, categories] = await Promise.all([listBudgets(user.id, year, month), listCategories(user.id)]);
  return (
    <>
      <PageHeader title="Orçamentos" description="Limites por categoria e mês, calculados com despesas efetivadas." />
      <BudgetManager
        key={`${year}-${month}`}
        budgets={budgets}
        categories={categories.map(({ id, name, type }) => ({ id, name, type }))}
        year={year}
        month={month}
      />
      {budgets.length > 0 && <BudgetChart data={budgets} />}
    </>
  );
}
