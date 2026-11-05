"use client";

import {
  ArrowLeftRight,
  BookOpen,
  Calculator,
  ChartColumn,
  Ellipsis,
  LayoutDashboard,
  Landmark,
  PiggyBank,
  Settings,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/atoms/Logo";
import { Modal } from "@/components/molecules/Modal";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: "/app", label: "Início", icon: LayoutDashboard },
  { href: "/app/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/app/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { href: "/app/metas", label: "Metas", icon: Target },
  { href: "/app/contas", label: "Contas", icon: Landmark },
  { href: "/app/relatorios", label: "Relatórios", icon: ChartColumn },
  { href: "/app/simulador", label: "Simulador", icon: Calculator },
  { href: "/app/assistente", label: "Assistente", icon: Sparkles },
  { href: "/app/aprender", label: "Aprender", icon: BookOpen },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface p-4 md:flex">
      <Link href="/app" aria-label="FinPilot, início" className="px-2 py-1">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                active ? "bg-positive-soft text-positive" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const BOTTOM = ITEMS.slice(0, 4);
const MORE = ITEMS.slice(4);

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((item) => isActive(pathname, item.href));
  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
      active ? "text-positive" : "text-muted",
    );
  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          );
        })}
        <button type="button" className={tabClass(moreActive)} onClick={() => setOpen(true)}>
          <Ellipsis aria-hidden className="size-5" />
          Mais
        </button>
      </nav>
      <Modal open={open} title="Mais opções" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-1">
          {MORE.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold hover:bg-surface-2"
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}
