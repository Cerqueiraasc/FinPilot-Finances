# API

Todas as rotas respondem JSON e exigem sessão, exceto as de `/api/auth/*` indicadas abaixo. Valores monetários são centavos inteiros e datas são `YYYY-MM-DD`.

## Erros

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Revise os campos informados.",
  "fieldErrors": { "amountCents": ["O valor deve ser maior que zero"] }
}
```

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_TOKEN` | Entrada inválida |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` | Sem sessão ou credenciais erradas |
| 403 | `FORBIDDEN_ORIGIN`, `DEMO_READONLY` | Outra origem ou ação bloqueada na demonstração |
| 404 | `NOT_FOUND` | Não existe ou pertence a outra pessoa |
| 409 | `CONFLICT`, `EMAIL_IN_USE`, `TRANSFER_LEG`, `ACCOUNT_HAS_HISTORY` | Conflito com o estado atual |
| 413 | `PAYLOAD_TOO_LARGE` | Corpo acima do limite (64 KB; importação, cerca de 2 a 4 MB) |
| 429 | `RATE_LIMITED` | Muitas tentativas |
| 500 | `INTERNAL_ERROR` | Erro inesperado, sem detalhes internos |

## Rotas

| Método e rota | Função |
|---|---|
| `POST /api/auth/register`, `login`, `demo`, `forgot-password`, `reset-password`, `verify-email` | Autenticação pública |
| `POST /api/auth/logout`, `resend-verification` | Autenticação com sessão |
| `PATCH /api/me`; `POST /api/me/password`; `POST /api/me/ai-preference` | Perfil, senha e consentimento de IA |
| `GET /api/me/sessions`; `DELETE /api/me/sessions/:id` | Sessões |
| `POST /api/onboarding` | Conclui as boas-vindas |
| `GET/POST /api/accounts`; `PATCH/DELETE /api/accounts/:id` | Contas |
| `GET/POST /api/categories`; `DELETE /api/categories/:id` | Categorias |
| `GET/POST /api/category-rules`; `DELETE /api/category-rules/:id`; `POST /api/category-rules/suggest` | Regras e sugestão |
| `GET/POST /api/transactions`; `GET/PATCH/DELETE /api/transactions/:id` | Transações |
| `POST /api/transfers`; `GET/PATCH/DELETE /api/transfers/:id` | Transferências |
| `GET/POST /api/recurrences`; `PATCH/DELETE /api/recurrences/:id` | Recorrências |
| `GET/POST /api/budgets`; `PATCH/DELETE /api/budgets/:id`; `POST /api/budget-alerts/:id/read` | Orçamentos e alertas |
| `GET/POST /api/goals`; `PATCH/DELETE /api/goals/:id` | Metas |
| `POST /api/goals/:id/contributions`; `DELETE /api/goals/contributions/:id` | Aportes |
| `GET /api/dashboard` | Dados do painel do período atual |
| `POST /api/imports/preview`; `POST /api/imports/commit` | Importação CSV |
| `GET /api/reports/export?from=&to=&accountId=&categoryId=` | Exportação CSV |
| `POST /api/simulations/purchase` | Simulador de compra |
| `GET /api/insights`; `POST /api/assistant/explain` | Insights e assistente |
| `POST /api/privacy/export`; `POST /api/privacy/delete-request` | Portabilidade e exclusão |

**Diferença em relação ao PRD:** `GET /api/dashboard` não recebe `from` e `to`; ele sempre usa o período financeiro atual. Períodos livres ficam em `/app/relatorios`.

## Exemplos

**Criar uma despesa**

```http
POST /api/transactions
{ "accountId": "...", "categoryId": "cat_lazer", "type": "EXPENSE", "amountCents": 12590,
  "description": "Cinema", "transactionDate": "2026-11-04", "status": "POSTED", "tags": [] }
```

Resposta: `{ "id": "..." }`.

**Listar com filtros**

`GET /api/transactions?page=1&pageSize=20&from=2026-11-01&to=2026-11-30&type=EXPENSE&search=cinema`

Resposta: `{ "items": [...], "total": 1, "page": 1, "pageSize": 20, "pageCount": 1 }`.

**Prévia de importação**

```http
POST /api/imports/preview
{ "accountId": "...", "filename": "extrato.csv", "csvText": "Data;Descrição;Valor\n...",
  "dateFormat": "DD/MM/YYYY" }
```

A resposta traz colunas, mapeamento sugerido e cada linha com `errors` e `duplicate`. Nada é gravado.

**Confirmar importação**

Envie o mesmo corpo com `mapping` e `decisions: [{ "rowIndex": 0, "include": true }]`. Linha sem decisão entra somente se não for duplicata.
