/**
 * Datas contábeis são strings "YYYY-MM-DD", sem fuso. Timestamps ficam em UTC e são
 * apresentados em America/Sao_Paulo.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

export type ISODate = string;

export interface FinancialPeriod {
  year: number;
  month: number;
  /** Primeiro dia, inclusivo. */
  from: ISODate;
  /** Primeiro dia do período seguinte, exclusivo. */
  toExclusive: ISODate;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isoToDate(value: ISODate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateToISO(value: Date): ISODate {
  return value.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date(), timeZone: string = APP_TIMEZONE): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = isoToDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToISO(date);
}

/** Soma meses preservando o dia, limitado ao último dia do mês de destino. */
export function addMonths(value: ISODate, months: number, anchorDay?: number): ISODate {
  const [year, month, day] = value.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(anchorDay ?? day, lastDay);
  return dateToISO(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
}

function isoFromParts(year: number, month: number, day: number): ISODate {
  return dateToISO(new Date(Date.UTC(year, month - 1, day)));
}

export function financialPeriod(year: number, month: number, startDay = 1): FinancialPeriod {
  const from = isoFromParts(year, month, startDay);
  return { year, month, from, toExclusive: addMonths(from, 1) };
}

/** Período financeiro que contém a data, considerando o dia de início escolhido pelo usuário. */
export function periodForDate(date: ISODate, startDay = 1): FinancialPeriod {
  const [year, month, day] = date.split("-").map(Number);
  if (day >= startDay) return financialPeriod(year, month, startDay);
  const previous = addMonths(isoFromParts(year, month, 1), -1);
  const [previousYear, previousMonth] = previous.split("-").map(Number);
  return financialPeriod(previousYear, previousMonth, startDay);
}

export function shiftPeriod(period: FinancialPeriod, months: number, startDay = 1): FinancialPeriod {
  const shifted = addMonths(isoFromParts(period.year, period.month, 1), months);
  const [year, month] = shifted.split("-").map(Number);
  return financialPeriod(year, month, startDay);
}

export function periodKey(period: Pick<FinancialPeriod, "year" | "month">): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function formatDate(value: ISODate): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function shortMonthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]}/${String(year).slice(2)}`;
}

export function longMonthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

/** Meses inteiros entre duas datas, sem considerar frações. */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  let months = (toYear - fromYear) * 12 + (toMonth - fromMonth);
  if (toDay < fromDay) months -= 1;
  return months;
}
