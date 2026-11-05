# Checklist de implementação

Legenda: `[x]` concluído, `[~]` parcial, `[ ]` pendente. Última verificação em 04/11/2026.

## Sprints

### Sprint 0: Fundação
- [x] Next.js, TypeScript strict, ESLint, Prettier, `.env.example`, Docker Compose, Prisma e testes
- [x] README e documentos em `docs/`
- [x] Autenticação, guards, design system e layout responsivo em Atomic Design

### Sprint 1: Núcleo financeiro
- [x] Schema, migrations e seed de categorias e demonstração
- [x] Contas, transações e transferências atômicas
- [x] Validações e testes de cálculo e de dono dos dados
- [ ] Cartão de crédito: adiado, como o PRD permite, e sinalizado na interface

### Sprint 2: Planejamento
- [x] Orçamentos e alertas de 80%, 100% e excesso
- [x] Metas, aportes e projeção linear
- [x] Recorrências idempotentes e edição de ocorrência ou série
- [x] Categorias personalizadas e regras
- [~] Aportes podem ser registrados e removidos, mas não editados

### Sprint 3: Visibilidade
- [x] Dashboard, relatórios, gráficos e filtros
- [x] Exportação CSV, com proteção contra fórmulas em planilhas
- [x] Importação CSV com mapeamento, prévia, duplicatas e confirmação

### Sprint 4: Inteligência
- [x] Motor determinístico de insights
- [x] Simulador de compra
- [x] Interface do assistente e fallback sem IA
- [~] Provedor de IA implementado e testado com simulação, **não testado na API real** por falta de chave

### Sprint 5: Qualidade e entrega
- [x] E2E, axe, teclado, responsividade e testes de autorização
- [x] Logs estruturados sem campos sensíveis
- [x] Documentação e roteiro de demonstração
- [ ] Rastreamento de erros e métricas operacionais
- [ ] Revisão de performance com medições
- [ ] Auditoria manual com leitor de tela
- [ ] Coleta dos KPIs de produto

## Critérios de aceite

| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | Usuário A não acessa recursos de B | Atendido | `tests/integration/auth-idor.test.ts`; E2E |
| 2 | Despesa de R$ 125,90 reduz 12.590 centavos | Atendido | Unitário, integração e E2E |
| 3 | Transferência mantém consolidado, receita e despesa | Atendido | Integração e E2E |
| 4 | Criar, editar e excluir mantém tudo consistente | Atendido | `tests/integration/ledger.test.ts` |
| 5 | CSV com prévia, revisão e sem duplicar no reenvio | Atendido | Integração e E2E |
| 6 | Alertas corretos sem repetição | Atendido | Integração e E2E |
| 7 | Metas com faltante e prazo só quando calculável | Atendido | Unitário e E2E |
| 8 | Simulador explica premissas, sem garantia | Atendido | Unitário e E2E |
| 9 | Assistente sem chave funciona e não fabrica números | Atendido | Integração e E2E |
| 10 | Dashboard vazio útil, sem dados demonstrativos | Atendido | E2E |
| 11 | Rotas privadas com autenticação e dono | Atendido | Integração e E2E |
| 12 | 375, 768 e 1440 px, teclado e contraste | Parcial | E2E confirma ausência de rolagem horizontal, axe sem violações e um fluxo de teclado. Falta auditoria manual completa. |
| 13 | Testes, build, lint e typecheck sem erros | Atendido | Resultados abaixo |
| 14 | README com instalação, migração, seed, testes, variáveis e deploy | Atendido | `README.md` |
| 15 | Exclusão, exportação e privacidade documentadas e testadas | Parcial | Fluxos testados. Prazos de backup e exceções legais continuam "a definir" em `docs/privacy-operations.md`. |

## Última execução

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sem erros |
| `npm run lint` | Sem erros nem avisos |
| `npx vitest run` | 98 testes passaram (6 arquivos) |
| `npx playwright test` | 15 testes de jornada passaram, com build de produção |

## Bloqueado ou dependente de terceiros

- **IA real:** requer `ANTHROPIC_API_KEY`.
- **E-mail em produção:** requer a escolha de um provedor.
- **Open Finance:** requer parceiro autorizado, contrato e avaliação jurídica.
- **Política de privacidade e termos:** requerem revisão jurídica.
