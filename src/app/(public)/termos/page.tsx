import { DocumentTemplate } from "@/components/templates/PublicTemplates";

export const metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <DocumentTemplate title="Termos de uso">
      <h2>O que é o FinPilot</h2>
      <p>Uma ferramenta de organização financeira pessoal e de educação financeira.</p>
      <h2>O que o FinPilot não faz</h2>
      <ul>
        <li>Não movimenta dinheiro, não executa ordens e não guarda recursos.</li>
        <li>Não recomenda ativos e não oferece aconselhamento financeiro profissional.</li>
        <li>Não garante rendimento, solvência ou resultado de simulações.</li>
      </ul>
      <h2>Sua responsabilidade</h2>
      <p>
        Os cálculos dependem dos dados que você registra. Você é responsável pelas decisões que tomar e por manter sua senha em segurança.
      </p>
    </DocumentTemplate>
  );
}
