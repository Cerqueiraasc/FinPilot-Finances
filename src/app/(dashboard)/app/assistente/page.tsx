import { PageHeader } from "@/components/molecules/Feedback";
import { AssistantPanel, InsightList } from "@/components/organisms/AssistantPanel";
import { requireUser } from "@/lib/auth/session";
import { listInsights } from "@/server/services/insights";

export const metadata = { title: "Assistente" };

export default async function AssistantPage() {
  const { user } = await requireUser();
  const insights = await listInsights(user.id);
  return (
    <>
      <PageHeader title="Assistente" description="Pontos de atenção calculados a partir dos seus registros." />
      <AssistantPanel aiEnabled={user.aiEnabled} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Pontos de atenção</h2>
        <InsightList insights={insights} />
      </section>
    </>
  );
}
