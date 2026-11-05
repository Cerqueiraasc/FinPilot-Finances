import { Landmark } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/atoms/Button";
import { EmptyState, PageHeader } from "@/components/molecules/Feedback";
import { ImportWizard } from "@/components/organisms/ImportWizard";
import { requireUser } from "@/lib/auth/session";
import { listAccounts } from "@/server/services/accounts";

export const metadata = { title: "Importar CSV" };

export default async function ImportPage() {
  const { user } = await requireUser();
  const accounts = await listAccounts(user.id);
  return (
    <>
      <PageHeader title="Importar CSV" description="Envie o arquivo, revise a prévia e confirme. Nada é gravado antes disso." />
      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Crie uma conta primeiro"
          description="Os lançamentos importados precisam de uma conta de destino."
          action={
            <Link href="/app/contas" className={buttonClasses("secondary")}>
              Ir para Contas
            </Link>
          }
        />
      ) : (
        <ImportWizard accounts={accounts.map(({ id, name }) => ({ id, name }))} />
      )}
    </>
  );
}
