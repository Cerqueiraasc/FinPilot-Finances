export interface GoalProgress {
  savedCents: number;
  remainingCents: number;
  percent: number;
}

export function goalProgress(
  targetCents: number,
  initialCents: number,
  contributionsCents: number[],
): GoalProgress {
  const savedCents = contributionsCents.reduce((sum, value) => sum + value, initialCents);
  return {
    savedCents,
    remainingCents: Math.max(targetCents - savedCents, 0),
    percent: savedCents <= 0 ? 0 : Math.floor((savedCents * 100) / targetCents),
  };
}

/** Prazo ilustrativo, sem rendimento. Usa teto para não prometer prazo menor. */
export function projectMonthsToGoal(remainingCents: number, monthlyCents: number): number | null {
  if (remainingCents <= 0) return 0;
  if (monthlyCents <= 0) return null;
  return Math.ceil(remainingCents / monthlyCents);
}

/** Média mensal das contribuições líquidas desde a primeira, em períodos completos ou parciais. */
export function averageMonthlyContribution(
  contributions: { amountCents: number; date: string }[],
  today: string,
): number {
  if (contributions.length === 0) return 0;
  const first = contributions.map((item) => item.date).sort()[0];
  const [firstYear, firstMonth] = first.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const months = Math.max((todayYear - firstYear) * 12 + (todayMonth - firstMonth) + 1, 1);
  const total = contributions.reduce((sum, item) => sum + item.amountCents, 0);
  return Math.floor(total / months);
}

/** Valor mensal necessário para atingir o alvo até o prazo. */
export function requiredMonthly(remainingCents: number, monthsLeft: number): number | null {
  if (remainingCents <= 0) return 0;
  if (monthsLeft <= 0) return null;
  return Math.ceil(remainingCents / monthsLeft);
}
