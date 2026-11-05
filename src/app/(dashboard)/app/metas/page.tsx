import { PageHeader } from "@/components/molecules/Feedback";
import { GoalManager } from "@/components/organisms/GoalManager";
import { requireUser } from "@/lib/auth/session";
import { listGoals } from "@/server/services/goals";

export const metadata = { title: "Metas" };

export default async function GoalsPage() {
  const { user } = await requireUser();
  const goals = await listGoals(user.id);
  return (
    <>
      <PageHeader title="Metas" description="Aportes são alocações virtuais: não alteram o saldo das contas." />
      <GoalManager goals={goals} />
    </>
  );
}
