import { ForgotPasswordForm, ResetPasswordForm } from "@/components/organisms/AuthForms";
import { AuthTemplate } from "@/components/templates/PublicTemplates";

export const metadata = { title: "Recuperar senha" };

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return token ? (
    <AuthTemplate title="Criar nova senha">
      <ResetPasswordForm token={token} />
    </AuthTemplate>
  ) : (
    <AuthTemplate title="Recuperar senha" description="Enviaremos um link para o seu e-mail.">
      <ForgotPasswordForm />
    </AuthTemplate>
  );
}
