# Registro de decisões

Decisões técnicas tomadas durante a implementação, conforme o PRD pede em caso de ambiguidade.

| # | Decisão | Motivo |
|---|---------|--------|
| 1 | **Atomic Design substitui `components/ui` e `components/finance`**: `components/atoms`, `molecules`, `organisms`, `templates`. As rotas do Next fazem o papel de "pages". | Pedido explícito do responsável pelo projeto, que prevalece sobre a estrutura sugerida no PRD. |
| 2 | **Sessão própria em banco, com cookie HttpOnly, em vez de Auth.js.** Hash da senha com Argon2id (`@node-rs/argon2`). | O PRD exige revogar sessões e encerrar as demais ao trocar a senha. O provedor de credenciais do Auth.js usa JWT, o que dificulta a revogação. O PRD cita o Auth.js apenas como exemplo. **Impacto:** o código de sessão é nosso e deve passar por revisão de segurança antes do lançamento. |
| 3 | **Componentes próprios, sem shadcn/ui.** | O PRD cita shadcn como exemplo. Átomos próprios deixam a hierarquia do Atomic Design explícita, e o `<dialog>` nativo cobre foco e Esc. |
| 4 | **Mutações por Route Handlers, sem Server Actions.** Leituras nas páginas chamam os serviços diretamente. | O PRD lista contratos REST. Um único caminho de escrita concentra autenticação, validação e formato de erro, e simplifica os testes de IDOR. |
| 5 | **Transferência = entidade `Transfer` + duas pernas em `Transaction`** (`TRANSFER_OUT` e `TRANSFER_IN`). | Representação única que evita dupla contagem: resumos somam só `INCOME`, `EXPENSE` e `REFUND`. |
| 6 | **Estorno é o tipo `REFUND`**: aumenta o saldo e abate despesa da categoria, sem contar como receita. | Atende ao requisito de não distorcer análises. |
| 7 | **Dinheiro:** `BigInt` no banco, `number` inteiro no código, com teto de R$ 10 bilhões e falha explícita fora do intervalo seguro. | Simplicidade com JSON sem perder precisão. Nenhum cálculo monetário usa float. A exceção é o simulador educativo de juros, que usa float na taxa e arredonda para centavos a cada mês. |
| 8 | **Cartão de crédito fica fora do MVP** e a interface informa isso. | O PRD autoriza adiar para não anunciar um modelo incompleto. Faltam fatura, fechamento, vencimento e pagamento. |
| 9 | **Lançamento efetivado não pode ter data futura.** Data futura vira `PENDING`. | Garante que itens futuros não afetem o saldo realizado. |
| 10 | **Ocorrências de recorrência são geradas ao abrir o app e por `npm run job:recurrences`**, até 60 dias à frente, com unicidade por regra e data. | Funciona sem infraestrutura de agendamento. Em produção, o job deve ser agendado. |
| 11 | **Excluir ocorrência de série a cancela em vez de apagar.** | Se a linha sumisse, a série poderia recriá-la. |
| 12 | **Hash de duplicidade:** com identificador externo, usa conta + identificador; sem ele, conta + data + valor com sinal + descrição normalizada. Importados mantêm o hash original ao serem editados. | Evita duplicar ao reenviar um arquivo mesmo depois de o usuário corrigir a descrição. |
| 13 | **Sem verificar e-mail o usuário entra, mas vê um aviso.** | Mantém a ativação simples. Pode virar bloqueio antes do lançamento público. |
| 14 | **E-mail em desenvolvimento é gravado em `.dev-mail/`.** Em produção, sem provedor real, o envio falha com erro explícito. | O PRD proíbe tokens em logs e não pede chaves externas no MVP. **Consequência:** cadastro e recuperação de senha não funcionam em produção até um provedor ser implementado. |
| 15 | **IA: SDK oficial da Anthropic, modelo `claude-opus-5-5` por padrão** (configurável em `ANTHROPIC_MODEL`), com `fallbacks: "default"`. | Só roda com chave, preferência ativa e consentimento. **Não foi testado contra a API real**, pois não há chave no ambiente; os testes usam um provedor simulado. |
| 16 | **Barreira contra valores inventados:** respostas da IA que citem valor em reais ausente das métricas enviadas são descartadas. | Requisito de não fabricar números. Cobre valores em reais, não percentuais. |
| 17 | **À IA só vão agregados.** Descrições, notas, títulos de metas e nomes de contas ficam de fora; categorias personalizadas têm nome genérico. | Minimização e redução da superfície de prompt injection. A pergunta digitada pelo usuário é enviada e tratada como dado não confiável. |
| 18 | **Exclusão de conta é imediata**, em cascata na base ativa. | Direito do titular. Prazos de backup e exceções legais continuam pendentes (ver `docs/privacy-operations.md`). |
| 19 | **Next.js sem `cacheComponents` e `partialPrefetching`** (ativados pelo gerador do projeto). | As páginas dependem de sessão e são todas dinâmicas. |
| 20 | **Prisma 7.10.1 em vez da tag `latest`.** | A tag `latest` aponta para o RC 8.0.0. O PRD pede versões estáveis. |
| 21 | **CSP com `'unsafe-inline'` em scripts.** | Necessário para os scripts inline do Next sem nonces. É o ponto mais fraco dos cabeçalhos e deve migrar para nonces antes de produção. |
| 22 | **`MockBankingProvider` não tem interface de usuário.** | O PRD pede o adapter no MVP, e sem tela não há risco de parecer uma conexão real. |
| 23 | **PWA limitado a manifesto e ícone**, sem service worker. | Modo offline é Fase 2 no PRD. |
