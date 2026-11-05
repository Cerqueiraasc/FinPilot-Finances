import { redirect } from "next/navigation";
import { LoginForm } from "@/components/organisms/AuthForms";
import { AuthTemplate } from "@/components/templates/PublicTemplates";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/app");
  return (
    <AuthTemplate title="Entrar" description="Acesse sua conta do FinPilot.">
      <LoginForm demoEnabled={process.env.DEMO_MODE_ENABLED === "true"} />
    </AuthTemplate>
  );
}
