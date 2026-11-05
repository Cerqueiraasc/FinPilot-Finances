import type { ReactNode } from "react";
import { Card } from "@/components/atoms/Card";

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="text-xl font-extrabold tracking-tight sm:text-2xl">{value}</p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </Card>
  );
}
