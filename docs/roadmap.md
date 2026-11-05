# Roadmap

## Antes de usuários reais

- Revisão jurídica e de LGPD da política de privacidade e dos termos, que hoje são rascunhos.
- Provedor real de e-mail. Sem ele, cadastro e recuperação de senha falham em produção.
- Revisão de segurança independente, com atenção ao código próprio de sessão.
- CSP com nonces no lugar de `'unsafe-inline'`.
- Rastreamento de erros e métricas, definição de backup e restauração, processo de resposta a incidentes.
- Agendamento de `npm run job:recurrences`.
- Medição de performance e auditoria manual com leitor de tela.

## Pendências funcionais do MVP

- Cartão de crédito como conta própria: compras, fatura, fechamento, vencimento e pagamento.
- Coleta dos KPIs do PRD (ativação, retenção, taxa de revisão de alertas e outros).
- Edição de aportes de metas (hoje é possível registrar e remover; as ações ficam auditadas).

## Fase 2

- Open Finance por parceiro autorizado, implementando a interface `BankingProvider`.
- Análise de assinaturas, alertas personalizáveis e notificações.
- Projeções de caixa e PWA com modo offline limitado.
- Simuladores de inflação e risco, sem indicar produtos.

## Fase 3

- Grupos familiares com permissões e consentimento de todas as pessoas.
- Módulo empresarial multi-tenant separado.
- Painéis administrativos com dados agregados e integrações contábeis.
- Recomendação individualizada somente após análise jurídica e regulatória (CVM, suitability e LGPD).
