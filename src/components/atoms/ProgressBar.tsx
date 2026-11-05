import { cn } from "@/lib/utils";

export function ProgressBar({
  percent,
  label,
  tone = "positive",
}: {
  percent: number;
  label: string;
  tone?: "positive" | "warning" | "negative";
}) {
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.max(percent, 0)}
      aria-valuemin={0}
      // Acima de 100% continua visível: o máximo acompanha o valor real.
      aria-valuemax={Math.max(percent, 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={cn(
          "h-full rounded-full",
          tone === "positive" && "bg-positive",
          tone === "warning" && "bg-warning",
          tone === "negative" && "bg-negative",
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
