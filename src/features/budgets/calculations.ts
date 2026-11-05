export type BudgetAlertLevel = "WARNING_80" | "REACHED_100" | "EXCEEDED";

export const ALERT_LEVEL_ORDER: BudgetAlertLevel[] = ["WARNING_80", "REACHED_100", "EXCEEDED"];

/** Percentual inteiro, arredondado para baixo: acima de 100% continua visível. */
export function budgetProgress(spentCents: number, limitCents: number): number {
  if (limitCents <= 0 || spentCents <= 0) return 0;
  return Math.floor((spentCents * 100) / limitCents);
}

/** Todas as faixas já atingidas. Usa inteiros para evitar erro de ponto flutuante. */
export function crossedAlertLevels(spentCents: number, limitCents: number): BudgetAlertLevel[] {
  const levels: BudgetAlertLevel[] = [];
  if (spentCents * 100 >= limitCents * 80) levels.push("WARNING_80");
  if (spentCents >= limitCents) levels.push("REACHED_100");
  if (spentCents > limitCents) levels.push("EXCEEDED");
  return levels;
}

export function highestAlertLevel(spentCents: number, limitCents: number): BudgetAlertLevel | null {
  const levels = crossedAlertLevels(spentCents, limitCents);
  return levels.length ? levels[levels.length - 1] : null;
}

export function alertMessage(level: BudgetAlertLevel, categoryName: string, percent: number): string {
  switch (level) {
    case "WARNING_80":
      return `${categoryName}: você usou ${percent}% do orçamento do mês.`;
    case "REACHED_100":
      return `${categoryName}: o orçamento do mês foi totalmente usado.`;
    case "EXCEEDED":
      return `${categoryName}: orçamento ultrapassado, em ${percent}% do limite.`;
  }
}
