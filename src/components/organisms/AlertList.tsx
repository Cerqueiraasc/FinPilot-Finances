"use client";

import { Button } from "@/components/atoms/Button";
import { Callout } from "@/components/molecules/Feedback";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import type { BudgetAlertDTO } from "@/server/services/budgets";

function AlertItem({ alert }: { alert: BudgetAlertDTO }) {
  const { submit, pending } = useApiSubmit();
  return (
    <Callout
      tone={alert.level === "EXCEEDED" ? "negative" : "warning"}
      action={
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => submit("POST", `/api/budget-alerts/${alert.id}/read`)}
        >
          Dispensar
        </Button>
      }
    >
      {alert.message}
    </Callout>
  );
}

export function AlertList({ alerts }: { alerts: BudgetAlertDTO[] }) {
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Alertas de orçamento" className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </section>
  );
}
