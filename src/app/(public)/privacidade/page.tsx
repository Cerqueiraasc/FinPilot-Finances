import { DocumentTemplate } from "@/components/templates/PublicTemplates";

export const metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <DocumentTemplate title="Política de privacidade">
      <h2>Quais dados tratamos</h2>
      <ul>
        <li>Cadastro: nome, e-mail e hash da senha.</li>
        <li>Dados financeiros que você registra: contas, lançamentos, orçamentos e metas.</li>
        <li>Dados técnicos de sessão: navegador e horários de uso.</li>
      </ul>
      <h2>Para que usamos</h2>
      <p>Somente para oferecer as funcionalidades do FinPilot. Não pedimos nem guardamos senha de banco.</p>
      <h2>Inteligência artificial</h2>
      <p>
        O uso de IA é opcional e depende do seu consentimento. Quando ativada, apenas métricas agregadas são enviadas ao provedor externo; descrições, notas e nomes de contas não são enviados. Você pode revogar o consentimento em Configurações.
      </p>
      <h2>Seus direitos</h2>
      <ul>
        <li>Exportar todos os seus dados em Configurações, em formato JSON.</li>
        <li>Excluir sua conta em Configurações. Os dados são removidos da base ativa na hora.</li>
        <li>Revogar consentimentos opcionais.</li>
      </ul>
      <h2>Retenção</h2>
      <p>
        Os dados ficam guardados enquanto a conta existir. Prazos de backups e eventuais exceções legais de retenção ainda precisam ser definidos antes do lançamento público.
      </p>
    </DocumentTemplate>
  );
}
