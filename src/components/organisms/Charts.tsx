"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Money } from "@/components/atoms/Money";
import { ChartFrame, DataTable } from "@/components/molecules/ChartFrame";
import { formatBRL } from "@/lib/money";

interface MonthlyPoint {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

// Só a escala do eixo perde centavos: tooltips e tabelas mostram o valor exato.
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const axisTick = { fill: "var(--muted)", fontSize: 12 };
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    color: "var(--ink)",
    fontSize: 13,
  },
  labelStyle: { color: "var(--ink)", fontWeight: 700 },
  itemStyle: { color: "var(--ink)" },
  cursor: { fill: "var(--surface-2)" },
};
// A legenda usa cor de texto e segue a ordem das barras; a cor da série fica na marca.
const legendProps = {
  itemSorter: null,
  wrapperStyle: { fontSize: 13 },
  formatter: (value: string) => <span style={{ color: "var(--muted)" }}>{value}</span>,
};
const money = (value: unknown) => formatBRL(Number(value));
const axisMoney = (value: number) => compact.format(value / 100);

export function CashflowChart({ data }: { data: MonthlyPoint[] }) {
  const last = data[data.length - 1];
  return (
    <ChartFrame
      title="Receitas e despesas"
      summary={last ? `Em ${last.label}: ${formatBRL(last.incomeCents)} de receitas e ${formatBRL(last.expenseCents)} de despesas.` : "Sem dados."}
      table={
        <DataTable
          caption="Receitas e despesas por mês"
          headers={["Mês", "Receitas", "Despesas"]}
          rows={data.map((point) => [
            point.label,
            <Money key="i" cents={point.incomeCents} />,
            <Money key="e" cents={point.expenseCents} />,
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart accessibilityLayer={false} data={data} barGap={2} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={64} />
          <Tooltip formatter={money} {...tooltipStyle} />
          <Legend {...legendProps} />
          <Bar dataKey="incomeCents" name="Receitas" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="expenseCents" name="Despesas" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BalanceChart({ data }: { data: MonthlyPoint[] }) {
  const last = data[data.length - 1];
  return (
    <ChartFrame
      title="Evolução do saldo"
      summary={last ? `Saldo consolidado em ${last.label}: ${formatBRL(last.balanceCents)}.` : "Sem dados."}
      table={
        <DataTable
          caption="Saldo consolidado por mês"
          headers={["Mês", "Saldo"]}
          rows={data.map((point) => [point.label, <Money key="b" cents={point.balanceCents} />])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart accessibilityLayer={false} data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={64} />
          <Tooltip formatter={money} {...tooltipStyle} cursor={{ stroke: "var(--line)" }} />
          <Line
            dataKey="balanceCents"
            name="Saldo"
            stroke="var(--series-balance)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--series-balance)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function CategoryChart({
  data,
}: {
  data: { categoryId: string | null; name: string; amountCents: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.amountCents, 0);
  const percent = (value: number) => (total > 0 ? Math.round((value * 100) / total) : 0);
  return (
    <ChartFrame
      title="Despesas por categoria"
      summary={data[0] ? `Maior categoria: ${data[0].name}, com ${percent(data[0].amountCents)}% do total.` : "Sem despesas no período."}
      table={
        <DataTable
          caption="Despesas por categoria"
          headers={["Categoria", "Valor", "Parte"]}
          rows={data.map((item) => [
            item.name,
            <Money key="v" cents={item.amountCents} />,
            `${percent(item.amountCents)}%`,
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(data.length * 38 + 16, 120)}>
        <BarChart accessibilityLayer={false} data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip formatter={money} {...tooltipStyle} />
          <Bar dataKey="amountCents" name="Despesas" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BudgetChart({
  data,
}: {
  data: { categoryName: string; limitCents: number; spentCents: number }[];
}) {
  const over = data.filter((item) => item.spentCents > item.limitCents).length;
  return (
    <ChartFrame
      title="Orçamento e realizado"
      summary={over > 0 ? `${over} categoria(s) acima do limite.` : "Nenhuma categoria acima do limite."}
      table={
        <DataTable
          caption="Orçamento e realizado por categoria"
          headers={["Categoria", "Limite", "Realizado"]}
          rows={data.map((item) => [
            item.categoryName,
            <Money key="l" cents={item.limitCents} />,
            <Money key="s" cents={item.spentCents} />,
          ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart accessibilityLayer={false} data={data} barGap={2} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="categoryName" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={64} />
          <Tooltip formatter={money} {...tooltipStyle} />
          <Legend {...legendProps} />
          <Bar dataKey="limitCents" name="Limite" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="spentCents" name="Realizado" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
