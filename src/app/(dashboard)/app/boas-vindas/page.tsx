import { redirect } from "next/navigation";
import { Card } from "@/components/atoms/Card";
import { PageHeader } from "@/components/molecules/Feedback";
import { OnboardingForm } from "@/components/organisms/OnboardingForm";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Boas-vindas" };

export default async function OnboardingPage() {
  const { user } = await requireUser();
  if (user.onboardedAt) redirect("/app");
  return (
    <>
      <PageHeader title="Boas-vindas ao FinPilot" description="Alguns dados para começar. Você pode mudar tudo depois." />
      <Card>
        <OnboardingForm />
      </Card>
    </>
  );
}
