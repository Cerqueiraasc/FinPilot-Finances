import { Badge } from "@/components/atoms/Badge";
import { Money } from "@/components/atoms/Money";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import type { BudgetAlertLevel } from "@/features/budgets/calculations";

const LEVEL = {
  WARNING_80: { label: "Atenção", tone: "warning" },
  REACHED_100: { label: "No limite", tone: "warning" },
  EXCEEDED: { label: "Ultrapassado", tone: "negative" },
} as const;

export function BudgetMeter({
  name,
  spentCents,
  limitCents,
  percent,
  level,
}: {
  name: string;
  spentCents: number;
  limitCents: number;
  percent: number;
  level: BudgetAlertLevel | null;
}) {
  const barTone =
    level === "EXCEEDED" ? "negative" : level === null ? "positive" : ("warning" as const);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{name}</span>
        <span className="flex items-center gap-2">
          {level && <Badge tone={LEVEL[level].tone}>{LEVEL[level].label}</Badge>}
          <span className="font-semibold tabular-nums">{percent}%</span>
        </span>
      </div>
      <ProgressBar percent={percent} label={`Orçamento de ${name}`} tone={barTone} />
      <p className="text-xs text-muted">
        <Money cents={spentCents} /> de <Money cents={limitCents} />
      </p>
    </div>
  );
}
