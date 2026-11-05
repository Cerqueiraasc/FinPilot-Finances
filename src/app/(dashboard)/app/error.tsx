"use client";

import { Button } from "@/components/atoms/Button";
import { Callout } from "@/components/molecules/Feedback";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-extrabold">Não foi possível carregar esta página</h1>
      <Callout tone="negative">Ocorreu um erro inesperado. Seus dados não foram alterados.</Callout>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
