import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/atoms/Card";
import { Logo } from "@/components/atoms/Logo";

export function AuthTemplate({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" aria-label="FinPilot, página inicial" className="self-start">
        <Logo />
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <Card>{children}</Card>
    </main>
  );
}

export function DocumentTemplate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/" aria-label="FinPilot, página inicial" className="self-start">
        <Logo />
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
        Rascunho sujeito a revisão jurídica. Não usar com pessoas reais antes dessa revisão.
      </p>
      <div className="flex flex-col gap-4 text-sm leading-relaxed [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
