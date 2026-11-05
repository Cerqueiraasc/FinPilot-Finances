import type { ReactNode } from "react";
import { AppShell } from "@/components/templates/AppShell";
import { requireUser } from "@/lib/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { materializeRecurrences } from "@/server/services/recurrences";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  await materializeRecurrences(user.id);
  const [accounts, categories] = await Promise.all([listAccounts(user.id), listCategories(user.id)]);
  return (
    <AppShell
      userName={user.name}
      isDemo={user.isDemo}
      emailVerified={user.emailVerifiedAt !== null}
      accounts={accounts.map(({ id, name }) => ({ id, name }))}
      categories={categories.map(({ id, name, type }) => ({ id, name, type }))}
    >
      {children}
    </AppShell>
  );
}
