import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/atoms/Button";
import { Money } from "@/components/atoms/Money";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { BudgetMeter } from "@/components/molecules/BudgetMeter";
import { TextField } from "@/components/molecules/FormField";
import { Callout } from "@/components/molecules/Feedback";

describe("átomos", () => {
  it("Money formata e marca valor negativo", () => {
    render(<Money cents={-12590} />);
    const value = screen.getByText("-R$ 125,90");
    expect(value.className).toContain("text-negative");
  });

  it("Button em carregamento fica desabilitado e não dispara clique", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ProgressBar mantém o valor real acima de 100%", () => {
    render(<ProgressBar percent={110} label="Orçamento" />);
    expect(screen.getByRole("progressbar", { name: "Orçamento" })).toHaveAttribute("aria-valuenow", "110");
  });
});

describe("moléculas", () => {
  it("TextField liga rótulo e erro ao campo", () => {
    render(<TextField label="E-mail" errors={["E-mail inválido"]} />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("E-mail inválido");
  });

  it("BudgetMeter comunica excesso por texto, não só por cor", () => {
    render(<BudgetMeter name="Lazer" spentCents={110000} limitCents={100000} percent={110} level="EXCEEDED" />);
    expect(screen.getByText("Ultrapassado")).toBeInTheDocument();
    expect(screen.getByText("110%")).toBeInTheDocument();
  });

  it("Callout mostra o conteúdo", () => {
    render(<Callout tone="warning">Atenção</Callout>);
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });
});
