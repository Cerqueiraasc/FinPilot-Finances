# Arquitetura

## Camadas

```
Navegador
  │  páginas (Server Components) e organismos (Client Components)
  ▼
src/app            Rotas. Páginas leem via serviços; mutações vão para /api.
src/lib/api        authedRoute/publicRoute: sessão, origem, tamanho, Zod, erros.
src/server/services   Casos de uso, sempre recebendo o userId da sessão.
src/server/repositories  Consultas compartilhadas: somas do razão e checagens de dono.
src/features       Regras puras e schemas Zod, sem acesso a banco.
src/lib/db + Prisma   PostgreSQL.
```

As regras financeiras ficam em `src/features/*`, em funções puras testadas sem banco. Os route handlers têm poucas linhas: validam a entrada, chamam um serviço e devolvem a resposta.

## Atomic Design

| Nível | Pasta | Exemplos | Regra |
|---|---|---|---|
| Átomos | `components/atoms` | Button, Input, Badge, Money, ProgressBar | Sem regra de negócio e sem chamadas à API |
| Moléculas | `components/molecules` | FormField, Modal, StatCard, BudgetMeter, ChartFrame | Combinam átomos com uma única função |
| Organismos | `components/organisms` | TransactionForms, ImportWizard, GoalManager, Charts | Seções completas que podem chamar a API |
| Templates | `components/templates` | AppShell, AuthTemplate, DocumentTemplate | Estrutura de página, sem dados próprios |
| Páginas | `app/**/page.tsx` | `/app`, `/app/metas` | Carregam dados e preenchem os templates |

**Exceção assumida:** `ConfirmButton` é uma molécula que chama a API, porque confirmar e executar uma exclusão é uma única função reutilizada em toda a interface.

## Segurança multiusuário

- O `userId` sai sempre da sessão no servidor e nunca é aceito do cliente.
- Toda consulta por ID filtra também pelo dono. Recurso de outra pessoa responde 404, como se não existisse.
- `src/proxy.ts` só verifica se o cookie existe, para redirecionar rápido. A validação real da sessão acontece em `requireUser` e `authedRoute`.
- As escritas conferem o cabeçalho `Origin`, além do cookie `SameSite=Lax`.
- Os limites de tentativas ficam no PostgreSQL, valendo entre instâncias do servidor.

## Fluxos críticos

- **Transferência:** `Transfer` e as duas pernas são gravadas em uma única transação de banco.
- **Importação:** a prévia não grava nada. A confirmação reprocessa o arquivo no servidor, refaz a checagem de duplicatas e grava o lote em uma transação serializável.
- **Alertas:** `BudgetAlert` tem unicidade por orçamento e faixa. Como o orçamento é mensal, cada faixa dispara uma vez por mês e categoria.
- **Assistente:** o motor determinístico roda sempre. A IA, se autorizada, recebe só agregados, e qualquer falha volta ao resultado determinístico.

## Datas

Datas contábeis são `YYYY-MM-DD` em colunas `date`. Timestamps ficam em UTC e são exibidos em `America/Sao_Paulo`. Um período mensal inclui o primeiro dia e exclui o primeiro dia do período seguinte, respeitando o dia de início escolhido pela pessoa.

## Versões

Node 24, Next.js 16.4.5, React 19.3, TypeScript 5.9 strict, Tailwind CSS 4, Prisma 7.10.1, PostgreSQL 17, Zod 4, Recharts 3, Vitest 5 e Playwright 1.64. O TypeScript fica na 5.x porque é a versão instalada pelo gerador do Next. As versões exatas estão em `package-lock.json`.
