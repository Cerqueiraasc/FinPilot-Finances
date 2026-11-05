import { ArrowLeftRight, Calculator, PiggyBank, ShieldCheck, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Logo } from "@/components/atoms/Logo";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";

const FEATURES = [
  { icon: ArrowLeftRight, title: "Tudo em um lugar", text: "Contas, receitas, despesas e transferências, com importação de extratos em CSV." },
  { icon: PiggyBank, title: "Orçamentos com alerta", text: "Limites por categoria, com avisos em 80%, 100% e ao ultrapassar." },
  { icon: Target, title: "Metas mensuráveis", text: "Acompanhe quanto falta e estime o prazo, sem promessa de rendimento." },
  { icon: Calculator, title: "Posso comprar?", text: "Veja o impacto de uma compra no saldo, no orçamento e nas metas antes de decidir." },
  { icon: Sparkles, title: "Assistente que explica", text: "Pontos de atenção calculados dos seus dados. A IA é opcional e só com sua autorização." },
  { icon: ShieldCheck, title: "Seus dados sob controle", text: "Exporte ou exclua tudo quando quiser. Não pedimos senha de banco." },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-12 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonClasses("secondary")}>
            Entrar
          </Link>
        </div>
      </header>
      <main className="flex flex-col gap-12">
        <section className="flex max-w-3xl flex-col gap-5 py-8">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Entenda para onde seu dinheiro vai e planeje para onde ele deve ir.
          </h1>
          <p className="text-lg text-muted">
            O FinPilot organiza suas finanças pessoais para você tomar decisões com mais consciência. Ele não movimenta dinheiro e não recomenda investimentos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/cadastro" className={buttonClasses("primary")}>
              Criar conta
            </Link>
            <Link href="/login" className={buttonClasses("secondary")}>
              Ver demonstração
            </Link>
          </div>
        </section>
        <section aria-label="Recursos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-5 text-primary" />
              <h2 className="font-bold">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </Card>
          ))}
        </section>
      </main>
      <footer className="mt-auto flex flex-wrap gap-4 border-t border-line pt-4 text-sm text-muted">
        <Link href="/privacidade" className="underline">
          Privacidade
        </Link>
        <Link href="/termos" className="underline">
          Termos
        </Link>
        <span>Conteúdo educativo. Não é aconselhamento financeiro profissional.</span>
      </footer>
    </div>
  );
}
