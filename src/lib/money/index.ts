/**
 * Valores monetários são sempre centavos inteiros. O banco usa BigInt; no código
 * trafegam como `number` seguro, limitado por MAX_AMOUNT_CENTS.
 */
export const MAX_AMOUNT_CENTS = 1_000_000_000_000; // R$ 10 bilhões

const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return formatter.format(cents / 100).replace(/ /g, " ");
}

/** Converte o BigInt do banco para number, falhando em vez de perder precisão. */
export function centsToNumber(value: bigint): number {
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber)) {
    throw new RangeError("Valor monetário fora do intervalo seguro");
  }
  return asNumber;
}

/**
 * Interpreta valores digitados ou vindos de CSV, sem passar por float:
 * "1.234,56", "1234,56", "1234.56", "R$ 125,90", "-10,00", "(10,00)".
 * Retorna null quando o texto não representa um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  let text = input.trim().replace(/R\$/gi, "").replace(/[\s ]/g, "");
  if (!text) return null;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  } else if (text.endsWith("-")) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let integerPart = text;
  let decimalPart = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const separator = Math.max(lastComma, lastDot);
    integerPart = text.slice(0, separator);
    decimalPart = text.slice(separator + 1);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const char = lastComma >= 0 ? "," : ".";
    const parts = text.split(char);
    const last = parts[parts.length - 1];
    // Um único separador com até 2 dígitos depois é decimal; grupos de 3 são milhar.
    if (parts.length === 2 && last.length <= 2) {
      integerPart = parts[0];
      decimalPart = last;
    } else if (parts.slice(1).every((part) => part.length === 3)) {
      integerPart = parts.join("");
    } else {
      return null;
    }
  }

  integerPart = integerPart.replace(/[.,]/g, "");
  if (decimalPart.length > 2 || !/^\d*$/.test(integerPart) || !/^\d*$/.test(decimalPart)) {
    return null;
  }

  const cents = Number(integerPart || "0") * 100 + Number(decimalPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return negative && cents !== 0 ? -cents : cents;
}

/** Formata centavos para edição em campo de texto: 12590 -> "125,90". */
export function centsToInput(cents: number): string {
  const absolute = Math.abs(cents);
  const reais = Math.trunc(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${reais},${remainder}`;
}
