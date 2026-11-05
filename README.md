# FinPilot

Plataforma web de gestão financeira pessoal: contas, transações, orçamentos, metas, relatórios, importação CSV, simulador de compra e assistente com IA opcional.

O FinPilot **não movimenta dinheiro, não se conecta a bancos e não recomenda investimentos**.

## Requisitos

- Node.js 24 ou compatível com Next.js 16
- Docker Desktop em execução (para o PostgreSQL 17)

Nenhuma chave externa é necessária.

## Como rodar

```bash
npm install
cp .env.example .env     # no PowerShell: Copy-Item .env.example .env
npm run db:up            # sobe o PostgreSQL
npm run db:deploy        # aplica as migrations
npm run db:seed          # categorias padrão e usuário de demonstração
npm run dev
```

Acesse http://localhost:3000.

> **Banco já criado antes:** o banco `finpilot_test` é criado só na primeira subida do volume. Se ele não existir, rode `docker exec finpilot-postgres psql -U finpilot -c "CREATE DATABASE finpilot_test OWNER finpilot"`.

### Conta de demonstração (somente seed local)

Clique em **Entrar na demonstração** em `/login` ou use:

- E-mail: `demo@finpilot.local`
- Senha: `demo-finpilot-123`

Os dados são fictícios e a interface sinaliza o modo demonstração. `npm run db:seed` restaura o estado inicial. O roteiro de apresentação está em [docs/demo-script.md](docs/demo-script.md).

### E-mails em desenvolvimento

Confirmação de e-mail e recuperação de senha são gravadas em arquivos na pasta `.dev-mail/`. Abra o arquivo mais recente para pegar o link.

## Comandos

| Comando | Função |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` e `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Testes unitários e de componentes |
| `npm run test:integration` | Testes de integração (exige PostgreSQL; apaga o banco `finpilot_test`) |
| `npm run test:e2e` | Testes E2E (na primeira vez, rode `npx playwright install chromium`; usa `finpilot_test` e a porta 3100) |
| `npm run db:migrate` | Cria uma nova migration em desenvolvimento |
| `npm run job:recurrences` | Gera as ocorrências de recorrências |

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | Conexão com o PostgreSQL |
| `APP_URL` | Sim | URL usada nos links de e-mail |
| `DEMO_MODE_ENABLED` | Não | `true` habilita o botão de demonstração |
| `EMAIL_PROVIDER` | Não | `file` grava em `.dev-mail/` (desenvolvimento) |
| `ANTHROPIC_API_KEY` | Não | Habilita a IA opcional |
| `ANTHROPIC_MODEL` | Não | Modelo da IA (padrão: `claude-opus-5-5`) |

Sem `ANTHROPIC_API_KEY`, o assistente funciona só com o motor determinístico. Com a chave, a IA ainda depende de a pessoa ativá-la em Configurações, e o uso gera custo na conta da chave.

## Estrutura

```
src/
  app/                  Rotas: (public), (auth), (dashboard)/app e api
  components/
    atoms/              Button, Input, Badge, Money...
    molecules/          FormField, Modal, StatCard, BudgetMeter...
    organisms/          TransactionForms, ImportWizard, Charts...
    templates/          AppShell, AuthTemplate...
  features/             Regras financeiras puras e schemas Zod
  lib/                  Auth, banco, dinheiro, datas, segurança, cliente de API
  server/
    services/           Casos de uso com verificação de dono
    repositories/       Consultas compartilhadas
    providers/          E-mail, IA e banco simulado
    jobs/               Tarefas agendáveis
prisma/                 Schema, migrations e seed
tests/                  unit, integration e e2e
docs/                   Arquitetura, decisões, API, roadmap e checklist
```

## Deploy

O projeto ainda **não está pronto para pessoas reais**: veja "Antes de usuários reais" em [docs/roadmap.md](docs/roadmap.md).

Para um ambiente de homologação:

1. Provisione PostgreSQL e configure as variáveis de ambiente, com `DEMO_MODE_ENABLED` desligado salvo em demonstração.
2. Implemente um provedor real em `src/server/providers/email.ts`. Em produção, sem ele, cadastro e recuperação de senha respondem com erro.
3. Execute `npm ci`, `npm run build` e `npm run db:deploy`.
4. Rode `npm run db:seed` para criar as categorias padrão. Com `NODE_ENV=production`, o seed não cria o usuário de demonstração.
5. Inicie com `npm start`, sob HTTPS, e agende `npm run job:recurrences` diariamente.

## Limitações conhecidas

- Cartão de crédito não está implementado.
- Sem conexão bancária real. Existe apenas a interface `BankingProvider` e uma simulação sem tela.
- A chamada à API de IA não foi testada com uma chave real.
- Política de privacidade e termos são rascunhos sem revisão jurídica.
- Acessibilidade verificada com axe e teclado, sem auditoria manual com leitor de tela.

Mais detalhes em [docs/decisions.md](docs/decisions.md) e [docs/implementation-checklist.md](docs/implementation-checklist.md).
