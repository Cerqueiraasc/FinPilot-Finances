import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Valor monetário em centavos. `signed` colore: vermelho é reservado a valores negativos. */
export function Money({
  cents,
  signed = false,
  className,
}: {
  cents: number;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        signed && cents > 0 && "text-positive",
        cents < 0 && "text-negative",
        className,
      )}
    >
      {signed && cents > 0 ? "+" : ""}
      {formatBRL(cents)}
    </span>
  );
}
