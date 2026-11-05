import type { ReactNode } from "react";
import { BottomNav, Sidebar } from "@/components/organisms/Navigation";
import { LogoutButton } from "@/components/organisms/LogoutButton";
import { QuickAdd, type AccountOption, type CategoryOption } from "@/components/organisms/TransactionForms";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";

export function AppShell({
  userName,
  isDemo,
  emailVerified,
  accounts,
  categories,
  children,
}: {
  userName: string;
  isDemo: boolean;
  emailVerified: boolean;
  accounts: AccountOption[];
  categories: CategoryOption[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemo && (
          <p className="bg-warning-soft px-4 py-2 text-center text-sm font-semibold text-warning">
            Modo demonstração: dados fictícios, sem conexão bancária real.
          </p>
        )}
        {!isDemo && !emailVerified && (
          <p className="bg-info-soft px-4 py-2 text-center text-sm font-medium text-info">
            Confirme seu e-mail pelo link que enviamos. Você pode reenviá-lo em Configurações.
          </p>
        )}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:px-6">
          <p className="min-w-0 truncate text-sm font-semibold text-muted">Olá, {userName}</p>
          <div className="flex items-center gap-1">
            <QuickAdd accounts={accounts} categories={categories} />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 sm:px-6 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
