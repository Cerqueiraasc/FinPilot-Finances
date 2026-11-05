import { Card } from "@/components/atoms/Card";
import { Callout, PageHeader } from "@/components/molecules/Feedback";
import { CompoundSimulator } from "@/components/organisms/CompoundSimulator";
import { GLOSSARY } from "@/features/insights/education";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Aprender" };

export default async function LearnPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Aprender" description="Conceitos básicos para entender finanças e investimentos." />
      <Callout tone="info">Conteúdo educativo. O FinPilot não indica produtos nem faz recomendações de investimento.</Callout>
      <CompoundSimulator />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Glossário</h2>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GLOSSARY.map(([term, definition]) => (
            <Card key={term}>
              <dt className="font-bold">{term}</dt>
              <dd className="mt-1 text-sm text-muted">{definition}</dd>
            </Card>
          ))}
        </dl>
      </section>
    </>
  );
}
