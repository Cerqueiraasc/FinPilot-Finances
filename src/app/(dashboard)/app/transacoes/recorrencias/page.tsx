import { PageHeader } from "@/components/molecules/Feedback";
import { RecurrenceManager } from "@/components/organisms/RecurrenceManager";
import { requireUser } from "@/lib/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { listRecurrences } from "@/server/services/recurrences";

export const metadata = { title: "Recorrências" };

export default async function RecurrencesPage() {
  const { user } = await requireUser();
  const [rules, accounts, categories] = await Promise.all([
    listRecurrences(user.id),
    listAccounts(user.id),
    listCategories(user.id),
  ]);
  return (
    <>
      <PageHeader title="Recorrências" description="Lançamentos que se repetem. As ocorrências futuras entram como previstas." />
      <RecurrenceManager
        rules={rules}
        accounts={accounts.map(({ id, name }) => ({ id, name }))}
        categories={categories.map(({ id, name, type }) => ({ id, name, type }))}
      />
    </>
  );
}
