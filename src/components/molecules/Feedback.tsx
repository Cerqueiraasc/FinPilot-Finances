import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <Icon aria-hidden className="size-8 text-muted" />
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export type CalloutTone = "info" | "warning" | "negative" | "positive";

const CALLOUTS: Record<CalloutTone, { icon: LucideIcon; classes: string }> = {
  info: { icon: Info, classes: "bg-info-soft text-info" },
  warning: { icon: AlertTriangle, classes: "bg-warning-soft text-warning" },
  negative: { icon: OctagonAlert, classes: "bg-negative-soft text-negative" },
  positive: { icon: CircleCheck, classes: "bg-positive-soft text-positive" },
};

/** Status sempre com ícone e texto, nunca só cor. */
export function Callout({
  tone = "info",
  children,
  action,
}: {
  tone?: CalloutTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { icon: Icon, classes } = CALLOUTS[tone];
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-sm", classes)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
