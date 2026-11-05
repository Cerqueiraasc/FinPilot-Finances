import { createHash } from "node:crypto";
import { isValidISODate } from "@/lib/dates";
import { parseBRLToCents } from "@/lib/money";
import { normalizeDescription } from "@/features/categories/rules";

export type DateFormat = "DD/MM/YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  externalId?: number | null;
}

export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: string[][];
}

function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Parser RFC 4180 com detecção de delimitador. Trata o conteúdo sempre como texto. */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (inQuotes) {
      if (char === '"' && clean[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((value) => value.trim() !== "")) records.push(record);

  const [headers = [], ...rows] = records;
  return { delimiter, headers: headers.map((header) => header.trim()), rows };
}

/** Sugere o mapeamento pelos nomes usuais de colunas em extratos brasileiros. */
export function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  const normalized = headers.map(normalizeDescription);
  const find = (...names: string[]) => {
    const index = normalized.findIndex((header) => names.some((name) => header.includes(name)));
    return index >= 0 ? index : undefined;
  };
  return {
    date: find("data", "date"),
    description: find("descri", "historico", "lancamento", "description", "titulo"),
    amount: find("valor", "amount", "montante"),
    externalId: find("identificador", "id transacao", "documento", "external"),
  };
}

export function normalizeCsvDate(value: string, format: DateFormat): string | null {
  const text = value.trim();
  let iso: string | null = null;
  if (format === "YYYY-MM-DD") {
    iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  } else {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (match) {
      const [first, second] = [match[1].padStart(2, "0"), match[2].padStart(2, "0")];
      iso =
        format === "DD/MM/YYYY"
          ? `${match[3]}-${second}-${first}`
          : `${match[3]}-${first}-${second}`;
    }
  }
  return iso && isValidISODate(iso) ? iso : null;
}

/** Hash estável por conta, data, valor assinado, descrição normalizada e identificador externo. */
export function computeDedupeHash(input: {
  accountId: string;
  date: string;
  signedAmountCents: number;
  description: string;
  externalId?: string | null;
}): string {
  // Com identificador externo, a descrição do banco pode variar sem indicar outra transação.
  const key = input.externalId
    ? [input.accountId, "ext", input.externalId.trim()]
    : [
        input.accountId,
        input.date,
        String(input.signedAmountCents),
        normalizeDescription(input.description),
      ];
  return createHash("sha256").update(key.join("|")).digest("hex");
}

export function fileChecksum(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface NormalizedRow {
  rowIndex: number;
  date: string | null;
  description: string;
  signedAmountCents: number | null;
  externalId: string | null;
  errors: string[];
}

export function normalizeRows(
  rows: string[][],
  mapping: ColumnMapping,
  dateFormat: DateFormat,
): NormalizedRow[] {
  return rows.map((row, rowIndex) => {
    const errors: string[] = [];
    const date = normalizeCsvDate(row[mapping.date] ?? "", dateFormat);
    if (!date) errors.push("Data inválida");
    const description = (row[mapping.description] ?? "").trim().slice(0, 200);
    if (!description) errors.push("Descrição vazia");
    const signedAmountCents = parseBRLToCents(row[mapping.amount] ?? "");
    if (signedAmountCents === null || signedAmountCents === 0) errors.push("Valor inválido");
    const externalId =
      mapping.externalId !== undefined && mapping.externalId !== null
        ? (row[mapping.externalId] ?? "").trim().slice(0, 120) || null
        : null;
    return { rowIndex, date, description, signedAmountCents, externalId, errors };
  });
}
