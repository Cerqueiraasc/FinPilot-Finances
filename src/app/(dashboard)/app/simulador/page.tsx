import { PageHeader } from "@/components/molecules/Feedback";
import { SimulatorForm } from "@/components/organisms/SimulatorForm";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/server/services/categories";

export const metadata = { title: "Simulador" };

export default async function SimulatorPage() {
  const { user } = await requireUser();
  const categories = await listCategories(user.id);
  return (
    <>
      <PageHeader title="Posso comprar?" description="Veja o impacto de uma compra antes de decidir. A decisão é sempre sua." />
      <SimulatorForm categories={categories.map(({ id, name, type }) => ({ id, name, type }))} />
    </>
  );
}
