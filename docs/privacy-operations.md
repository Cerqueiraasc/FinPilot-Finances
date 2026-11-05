# Privacidade e operação

Rascunho técnico, sem valor de parecer jurídico. Precisa de revisão antes do lançamento público.

## O que está implementado

| Direito ou controle | Como funciona | Teste |
|---|---|---|
| Exportação | `POST /api/privacy/export` devolve um JSON com todos os dados, sem hash de senha e tokens | Integração e E2E |
| Exclusão | `POST /api/privacy/delete-request` exige senha e a palavra `EXCLUIR`, e remove tudo em cascata na hora | Integração e E2E |
| Consentimento de IA | Cada concessão ou revogação fica registrada em `Consent` | Integração |
| Registro de ações | `AuditEvent` guarda ação e alvo, sem valores nem textos | Implícito nos fluxos |
| Logs | JSON estruturado; chaves sensíveis são removidas e erros registram só tipo e código | Sem teste automatizado |

## Prazos de exclusão e retenção

- **Base ativa:** exclusão imediata.
- **Backups:** **a definir.** Ainda não existe política de backup; o prazo depende da infraestrutura escolhida.
- **Exceções legais de retenção:** **a definir** com apoio jurídico.

## Definir antes do lançamento

1. **Backup e restauração:** frequência, retenção, criptografia, teste periódico de restauração e como reaplicar exclusões após restaurar um backup.
2. **Resposta a incidentes:** responsáveis, contenção, avaliação de impacto e comunicação à ANPD e às pessoas afetadas quando exigido.
3. **Criptografia em repouso:** depende da infraestrutura. Nada aqui afirma que ela já esteja ativa.
4. **Certificações:** o FinPilot não possui nenhuma.
5. **Encarregado de dados e canal de atendimento.**
6. **Retenção no provedor de IA**, caso a IA seja habilitada.

## Open Finance

O projeto só contém a interface `BankingProvider` e uma simulação (`MockBankingProvider`), rotulada "Demonstração — sem conexão bancária real". Não há conexão com bancos. Uma integração real exige parceiro autorizado, contrato, fluxo de consentimento e avaliação jurídica.
