export type RuleMatchType = "CONTAINS" | "STARTS_WITH" | "EQUALS";

export interface CategorizationRule {
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  priority: number;
}

export function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matches(rule: CategorizationRule, normalized: string): boolean {
  const pattern = normalizeDescription(rule.pattern);
  if (!pattern) return false;
  switch (rule.matchType) {
    case "CONTAINS":
      return normalized.includes(pattern);
    case "STARTS_WITH":
      return normalized.startsWith(pattern);
    case "EQUALS":
      return normalized === pattern;
  }
}

/** Palavras-chave da classificação heurística, usadas somente se nenhuma regra do usuário casar. */
export const HEURISTIC_KEYWORDS: Record<string, string[]> = {
  Moradia: ["aluguel", "condominio", "energia", "luz", "agua", "internet"],
  Alimentação: ["mercado", "supermercado", "padaria", "restaurante", "ifood", "lanche"],
  Transporte: ["uber", "99", "combustivel", "gasolina", "posto", "metro", "onibus"],
  Saúde: ["farmacia", "drogaria", "consulta", "plano de saude", "exame"],
  Educação: ["curso", "faculdade", "escola", "livro"],
  Lazer: ["cinema", "show", "teatro", "bar ", "viagem"],
  Assinaturas: ["netflix", "spotify", "assinatura", "prime video", "youtube premium"],
  Impostos: ["iptu", "ipva", "imposto", "darf"],
  Salário: ["salario", "folha de pagamento", "pagamento empresa"],
  Freelance: ["freelance", "freela", "honorarios"],
  Rendimentos: ["rendimento", "juros", "dividendo"],
};

/**
 * Sugere uma categoria: regras do usuário têm prioridade (menor número primeiro) sobre a
 * heurística. O resultado é sempre uma sugestão editável.
 */
export function suggestCategoryId(
  description: string,
  rules: CategorizationRule[],
  heuristicCategories: { id: string; name: string }[] = [],
): string | null {
  const normalized = normalizeDescription(description);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (matches(rule, normalized)) return rule.categoryId;
  }
  for (const category of heuristicCategories) {
    const keywords = HEURISTIC_KEYWORDS[category.name];
    if (keywords?.some((keyword) => normalized.includes(keyword))) return category.id;
  }
  return null;
}
