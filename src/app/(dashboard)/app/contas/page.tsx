import { Money } from "@/components/atoms/Money";
import { Callout, PageHeader } from "@/components/molecules/Feedback";
import { AccountManager } from "@/components/organisms/AccountManager";
import { requireUser } from "@/lib/auth/session";
import { listAccounts } from "@/server/services/accounts";

export const metadata = { title: "Contas" };

export default async function AccountsPage() {
  const { user } = await requireUser();
  const accounts = await listAccounts(user.id, { includeArchived: true });
  const total = accounts.reduce((sum, account) => sum + account.balanceCents, 0);
  return (
    <>
      <PageHeader
        title="Contas"
        description="Contas manuais: corrente, poupança e dinheiro."
        actions={
          <p className="text-sm text-muted">
            Saldo total <Money cents={total} className="text-lg font-extrabold text-ink" />
          </p>
        }
      />
      <Callout tone="info">
        Cartão de crédito ainda não está disponível: chegará quando fatura e pagamento estiverem modelados corretamente.
      </Callout>
      <AccountManager accounts={accounts} />
    </>
  );
}
