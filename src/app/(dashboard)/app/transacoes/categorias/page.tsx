import { PageHeader } from "@/components/molecules/Feedback";
import { CategoryManager } from "@/components/organisms/CategoryManager";
import { requireUser } from "@/lib/auth/session";
import { listCategories, listRules } from "@/server/services/categories";

export const metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const { user } = await requireUser();
  const [categories, rules] = await Promise.all([listCategories(user.id), listRules(user.id)]);
  return (
    <>
      <PageHeader title="Categorias e regras" description="Personalize categorias e automatize sugestões." />
      <CategoryManager categories={categories} rules={rules} />
    </>
  );
}
