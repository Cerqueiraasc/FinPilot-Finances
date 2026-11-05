import { addDays, addMonths, type ISODate } from "@/lib/dates";

export type Cadence = "WEEKLY" | "MONTHLY" | "YEARLY";

/** N-ésima ocorrência a partir do início. Calcula sempre do início para preservar o dia 31. */
export function occurrenceAt(startDate: ISODate, cadence: Cadence, index: number): ISODate {
  const anchorDay = Number(startDate.split("-")[2]);
  switch (cadence) {
    case "WEEKLY":
      return addDays(startDate, index * 7);
    case "MONTHLY":
      return addMonths(startDate, index, anchorDay);
    case "YEARLY":
      return addMonths(startDate, index * 12, anchorDay);
  }
}

/** Datas de ocorrência em [fromInclusive, upToInclusive], respeitando o fim da série. */
export function occurrencesBetween(
  startDate: ISODate,
  cadence: Cadence,
  fromInclusive: ISODate,
  upToInclusive: ISODate,
  endDate: ISODate | null = null,
): ISODate[] {
  const dates: ISODate[] = [];
  for (let index = 0; index < 5000; index += 1) {
    const date = occurrenceAt(startDate, cadence, index);
    if (date > upToInclusive || (endDate && date > endDate)) break;
    if (date >= fromInclusive) dates.push(date);
  }
  return dates;
}

export function nextOccurrenceAfter(startDate: ISODate, cadence: Cadence, after: ISODate): ISODate {
  for (let index = 0; index < 5000; index += 1) {
    const date = occurrenceAt(startDate, cadence, index);
    if (date > after) return date;
  }
  throw new RangeError("Recorrência fora do intervalo calculável");
}
