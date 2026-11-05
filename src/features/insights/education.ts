export const GLOSSARY = [
  ["Renda fixa", "Investimentos cujas regras de remuneração são definidas na contratação. Ainda assim têm riscos, como o de crédito e o de liquidez."],
  ["Renda variável", "Investimentos cujo retorno não é conhecido de antemão, como ações. Os preços podem subir ou cair."],
  ["Liquidez", "Facilidade de transformar um investimento em dinheiro, sem grande perda de valor."],
  ["Volatilidade", "Intensidade com que um preço oscila. Oscilação alta significa maior incerteza no curto prazo."],
  ["Diversificação", "Distribuir recursos entre ativos diferentes para reduzir o efeito de um único resultado ruim."],
  ["Risco", "Possibilidade de o resultado ser diferente do esperado, inclusive com perda de dinheiro."],
  ["Inflação", "Aumento geral de preços ao longo do tempo, que reduz o poder de compra do dinheiro."],
  ["Juros compostos", "Juros calculados sobre o valor inicial e também sobre os juros já acumulados."],
  ["Reserva de emergência", "Dinheiro separado para imprevistos, normalmente em aplicação de fácil resgate."],
] as const;

/**
 * Cenário hipotético com a taxa informada pelo usuário. Usa float apenas na taxa
 * e arredonda para centavos inteiros a cada mês.
 */
export function compoundProjection(
  initialCents: number,
  monthlyCents: number,
  annualRatePercent: number,
  years: number,
) {
  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
  const months = years * 12;
  let balance = initialCents;
  for (let month = 0; month < months; month += 1) {
    balance = Math.round(balance * (1 + monthlyRate)) + monthlyCents;
  }
  const contributedCents = initialCents + monthlyCents * months;
  return { finalCents: balance, contributedCents, interestCents: balance - contributedCents };
}
