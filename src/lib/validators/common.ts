import { z } from "zod";
import { isValidISODate } from "@/lib/dates";
import { MAX_AMOUNT_CENTS } from "@/lib/money";

export const idSchema = z.string().trim().min(1).max(64);

export const isoDateSchema = z
  .string()
  .refine(isValidISODate, { message: "Data inválida" });

export const positiveCentsSchema = z
  .number({ error: "Informe um valor válido" })
  .int("Valor inválido")
  .positive("O valor deve ser maior que zero")
  .max(MAX_AMOUNT_CENTS, "Valor acima do limite permitido");

/** Permite negativo e zero (ex.: saldo inicial de conta). */
export const signedCentsSchema = z
  .number({ error: "Informe um valor válido" })
  .int("Valor inválido")
  .min(-MAX_AMOUNT_CENTS, "Valor fora do limite permitido")
  .max(MAX_AMOUNT_CENTS, "Valor fora do limite permitido");

export const nonNegativeCentsSchema = signedCentsSchema.min(0, "O valor não pode ser negativo");

export const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .transform((value) => (value === "" ? null : value))
    .nullish();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
