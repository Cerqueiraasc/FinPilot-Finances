import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/organisms/AuthForms";
import { AuthTemplate } from "@/components/templates/PublicTemplates";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  if (await getCurrentSession()) redirect("/app");
  return (
    <AuthTemplate title="Criar conta" description="Comece a organizar suas finanças.">
      <RegisterForm />
    </AuthTemplate>
  );
}
