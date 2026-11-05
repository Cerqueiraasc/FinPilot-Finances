import { VerifyEmailAction } from "@/components/organisms/AuthForms";
import { Callout } from "@/components/molecules/Feedback";
import { AuthTemplate } from "@/components/templates/PublicTemplates";

export const metadata = { title: "Confirmar e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthTemplate title="Confirmar e-mail">
      {/* A confirmação exige um clique: pré-visualizadores de link não consomem o token. */}
      {token ? <VerifyEmailAction token={token} /> : <Callout tone="negative">Link inválido.</Callout>}
    </AuthTemplate>
  );
}
