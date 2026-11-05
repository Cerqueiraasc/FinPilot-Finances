import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { BudgetMeter } from "@/components/molecules/BudgetMeter";
import { EmptyState, PageHeader } from "@/components/molecules/Feedback";
import { StatCard } from "@/components/molecules/StatCard";
import { AlertList } from "@/components/organisms/AlertList";
import { BalanceChart, CashflowChart, CategoryChart } from "@/components/organisms/Charts";
import { requireUser } from "@/lib/auth/session";
import { longMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { getDashboard } from "@/server/services/dashboard";

export const metadata = { title: "Início" };

export default async function DashboardPage() {
  const { user } = await requireUser();
  if (!user.onboardedAt) redirect("/app/boas-vindas");
  const data = await getDashboard(user.id, user.financialMonthStartDay);
  const partialNote = data.periodIsPartial ? "Mês em andamento" : "Mês completo";

  return (
    <>
      <PageHeader title="Início" description={`Resumo de ${longMonthLabel(data.period.year, data.period.month)}.`} />
      <AlertList alerts={data.alerts} />
      <section aria-label="Resumo do mês" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo consolidado"
          value={<Money cents={data.balanceCents} />}
          detail={
            data.plannedNet30DaysCents !== 0
              ? `Previstos em 30 dias: ${formatBRL(data.plannedNet30DaysCents)}`
              : "Somente lançamentos efetivados"
          }
        />
        <StatCard label="Receitas" value={<Money cents={data.summary.incomeCents} />} detail={partialNote} />
        <StatCard label="Despesas" value={<Money cents={data.summary.expenseCents} />} detail={partialNote} />
        <StatCard
          label="Economia líquida"
          value={<Money cents={data.summary.netCents} />}
          detail={
            data.summary.savingsRate === null
              ? "Taxa de poupança: N/D"
              : `Taxa de poupança: ${data.summary.savingsRate.toLocaleString("pt-BR")}%`
          }
        />
      </section>

      {!data.hasData ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Seus gráficos aparecem aqui"
          description={
            data.hasAccounts
              ? "Registre suas primeiras transações ou importe um extrato em CSV para ver a evolução mensal."
              : "Crie uma conta e registre suas primeiras transações."
          }
          action={
            <Link
              href={data.hasAccounts ? "/app/transacoes/importar" : "/app/contas"}
              className={buttonClasses("secondary")}
            >
              {data.hasAccounts ? "Importar CSV" : "Criar conta"}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <CashflowChart data={data.series} />
            <BalanceChart data={data.series} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.categories.length > 0 ? (
              <CategoryChart data={data.categories} />
            ) : (
              <Card>
                <h2 className="font-bold">Despesas por categoria</h2>
                <p className="mt-1 text-sm text-muted">Sem despesas efetivadas neste mês.</p>
              </Card>
            )}
            <div className="flex flex-col gap-4">
              <Card className="flex flex-col gap-4">
                <h2 className="font-bold">Orçamentos do mês</h2>
                {data.budgets.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nenhum orçamento neste mês.{" "}
                    <Link href="/app/orcamentos" className="font-semibold text-accent underline">
                      Definir limites
                    </Link>
                  </p>
                ) : (
                  data.budgets.map((budget) => (
                    <BudgetMeter
                      key={budget.id}
                      name={budget.categoryName}
                      spentCents={budget.spentCents}
                      limitCents={budget.limitCents}
                      percent={budget.percent}
                      level={budget.level}
                    />
                  ))
                )}
              </Card>
              <Card className="flex flex-col gap-4">
                <h2 className="font-bold">Metas</h2>
                {data.goals.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nenhuma meta ativa.{" "}
                    <Link href="/app/metas" className="font-semibold text-accent underline">
                      Criar meta
                    </Link>
                  </p>
                ) : (
                  data.goals.slice(0, 3).map((goal) => (
                    <div key={goal.id} className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-semibold">{goal.title}</span>
                        <span className="font-semibold tabular-nums">{goal.percent}%</span>
                      </div>
                      <ProgressBar percent={goal.percent} label={`Progresso de ${goal.title}`} />
                      <p className="text-xs text-muted">
                        Faltam <Money cents={goal.remainingCents} />
                      </p>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
