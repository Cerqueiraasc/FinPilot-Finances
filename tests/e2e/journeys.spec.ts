import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "senha-e2e-bem-longa";

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function register(page: Page, email = uniqueEmail()) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Boas-vindas ao FinPilot" })).toBeVisible();
  return email;
}

async function onboard(page: Page, opening = "1.000,00") {
  await page.getByLabel("Saldo atual (R$)").fill(opening);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
}

async function addExpense(page: Page, description: string, amount: string, category: string) {
  await page.getByRole("button", { name: /Adicionar/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor (R$)").fill(amount);
  await dialog.getByLabel("Descrição").fill(description);
  await dialog.getByLabel("Categoria").selectOption({ label: category });
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status").getByText("Transação registrada.")).toBeVisible();
  await expect(dialog).toBeHidden();
}

const balanceCard = (page: Page) =>
  page.getByRole("region", { name: "Resumo do mês" }).getByText("Saldo consolidado").locator("..");

test("rotas privadas exigem login", async ({ page, request }) => {
  await page.goto("/app/transacoes");
  await expect(page).toHaveURL(/\/login$/);
  const response = await request.get("/api/transactions");
  expect(response.status()).toBe(401);
});

test("cookie de sessão inválido não abre o app", async ({ page, context }) => {
  await context.addCookies([
    { name: "finpilot_session", value: "invalido", domain: "localhost", path: "/" },
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("dashboard vazio não mistura dados de demonstração", async ({ page }) => {
  await register(page);
  await onboard(page, "0");
  await expect(page.getByText("Seus gráficos aparecem aqui")).toBeVisible();
  await expect(page.getByText("Modo demonstração")).toHaveCount(0);
  await expect(page.getByText("Taxa de poupança: N/D")).toBeVisible();
});

test("despesa altera o saldo em exatamente R$ 125,90 e alerta de orçamento aparece", async ({ page }) => {
  await register(page);
  await onboard(page);
  await expect(balanceCard(page)).toContainText("R$ 1.000,00");

  await addExpense(page, "Cinema", "125,90", "Lazer");
  await expect(balanceCard(page)).toContainText("R$ 874,10");

  await page.goto("/app/orcamentos");
  await page.getByRole("button", { name: "Novo orçamento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Categoria").selectOption({ label: "Lazer" });
  await dialog.getByLabel("Limite do mês (R$)").fill("150,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("83%")).toBeVisible();

  await page.goto("/app");
  await expect(page.getByText("Lazer: você usou 83% do orçamento do mês.")).toBeVisible();

  await addExpense(page, "Show", "50,00", "Lazer");
  await expect(page.getByText(/Lazer: orçamento ultrapassado, em 117% do limite/)).toBeVisible();
  await expect(page.getByText("você usou 83%")).toHaveCount(0);
});

test("transferência mantém o saldo consolidado e pode ser excluída", async ({ page }) => {
  await register(page);
  await onboard(page);

  await page.goto("/app/contas");
  await page.getByRole("button", { name: "Nova conta" }).click();
  const newAccount = page.getByRole("dialog");
  await newAccount.getByLabel("Nome").fill("Poupança");
  await newAccount.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Poupança" })).toBeVisible();

  await page.getByRole("button", { name: /Adicionar/ }).click();
  await page.getByRole("button", { name: "É uma transferência entre contas?" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor (R$)").fill("300,00");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status").getByText("Transferência registrada.")).toBeVisible();

  await expect(page.getByText("R$ 700,00").first()).toBeVisible();
  await expect(page.getByText("R$ 300,00").first()).toBeVisible();

  await page.goto("/app");
  await expect(balanceCard(page)).toContainText("R$ 1.000,00");
  await expect(
    page.getByRole("region", { name: "Resumo do mês" }).getByText("Despesas", { exact: true }).locator(".."),
  ).toContainText("R$ 0,00");

  await page.goto("/app/transacoes");
  await page.getByRole("button", { name: "Excluir Transferência entre contas" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText("Nenhuma transação ainda")).toBeVisible();

  await page.goto("/app/contas");
  await expect(page.getByText("R$ 1.000,00").first()).toBeVisible();
});

test("meta, simulador e assistente sem IA", async ({ page }) => {
  await register(page);
  await onboard(page);

  await page.goto("/app/metas");
  await page.getByRole("button", { name: "Nova meta" }).click();
  const goal = page.getByRole("dialog");
  await goal.getByLabel("Título").fill("Viagem");
  await goal.getByLabel("Valor-alvo (R$)").fill("1.000,00");
  await goal.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Viagem" })).toBeVisible();
  await expect(page.getByText("Sem previsão")).toBeVisible();

  await page.getByRole("button", { name: "Registrar aporte" }).click();
  const contribution = page.getByRole("dialog");
  await contribution.getByLabel("Valor (R$)").fill("250,00");
  await contribution.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("(25%)")).toBeVisible();
  await expect(page.getByText("3 meses")).toBeVisible();

  await page.goto("/app/simulador");
  await page.getByLabel("Valor da compra (R$)").fill("200,00");
  await page.getByRole("button", { name: "Simular" }).click();
  await expect(page.getByText("Saldo projetado", { exact: true }).locator("..")).toContainText("R$ 800,00");
  await expect(page.getByText(/sem garantia de que o saldo se confirmará/)).toBeVisible();

  await page.goto("/app/assistente");
  await page.getByLabel("Sua pergunta").fill("Qual é o meu saldo?");
  await page.getByRole("button", { name: "Perguntar" }).click();
  await expect(page.getByText("Calculado dos seus dados")).toBeVisible();
  await expect(page.getByText(/saldo consolidado realizado é de R\$ 1\.000,00/)).toBeVisible();
});

test("importação CSV mostra prévia e não duplica no reenvio", async ({ page }) => {
  await register(page);
  await onboard(page);
  const file = {
    name: "extrato.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Data;Descrição;Valor\n01/10/2026;Padaria;-20,00\n02/10/2026;Freela;500,00\n03/10/2026;Padaria;-20,00\n",
    ),
  };

  await page.goto("/app/transacoes/importar");
  await page.getByLabel("Arquivo CSV").setInputFiles(file);
  await expect(page.getByText("Prévia: nada foi gravado ainda")).toBeVisible();
  await expect(page.getByText("3 selecionada(s)")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("3 lançamento(s) importado(s)")).toBeVisible();

  await page.getByRole("button", { name: "Importar outro arquivo" }).click();
  await page.getByLabel("Arquivo CSV").setInputFiles(file);
  await expect(page.getByText("Este mesmo arquivo já foi importado")).toBeVisible();
  await expect(page.getByText("3 duplicada(s)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toBeDisabled();

  await page.goto("/app/transacoes");
  await expect(page.getByText("3 lançamentos")).toBeVisible();
});

test("usuário B não acessa dados do usuário A pela API", async ({ page, browser }) => {
  await register(page);
  await onboard(page);
  const accounts = await (await page.request.get("/api/accounts")).json();
  const accountId = accounts.items[0].id;

  const other = await browser.newContext({ baseURL: "http://localhost:3100" });
  const otherPage = await other.newPage();
  await register(otherPage);
  const attempt = await otherPage.request.patch(`/api/accounts/${accountId}`, {
    data: { name: "Invadida" },
  });
  expect(attempt.status()).toBe(404);
  await other.close();

  const after = await (await page.request.get("/api/accounts")).json();
  expect(after.items[0].name).toBe("Conta corrente");
});

test("exportação e exclusão da conta encerram o acesso", async ({ page }) => {
  const email = await register(page);
  await onboard(page);
  await page.goto("/app/configuracoes");

  const exported = await page.request.post("/api/privacy/export");
  expect(exported.ok()).toBe(true);
  expect(await exported.text()).not.toContain("passwordHash");

  await page.getByRole("button", { name: "Excluir conta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Sua senha").fill(PASSWORD);
  await dialog.getByLabel('Digite "EXCLUIR" para confirmar').fill("EXCLUIR");
  await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test.describe("demonstração, responsividade e acessibilidade", () => {
  const ROUTES = [
    "/app",
    "/app/transacoes",
    "/app/transacoes/recorrencias",
    "/app/transacoes/categorias",
    "/app/transacoes/importar",
    "/app/contas",
    "/app/orcamentos",
    "/app/metas",
    "/app/relatorios",
    "/app/simulador",
    "/app/assistente",
    "/app/aprender",
    "/app/configuracoes",
  ];

  async function enterDemo(page: Page) {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar na demonstração" }).click();
    await expect(page.getByText("Modo demonstração: dados fictícios")).toBeVisible();
  }

  for (const width of [375, 768, 1440]) {
    test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await enterDemo(page);
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} em ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  for (const theme of ["light", "dark"] as const) {
    test(`sem violações WCAG A/AA detectáveis no tema ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("finpilot-theme", value), theme);
      await enterDemo(page);
      for (const route of [...ROUTES, "/"]) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const summary = results.violations.map(
          (violation) => `${violation.id}: ${violation.nodes[0]?.target.join(" ")}`,
        );
        expect(summary, `${route} (${theme})`).toEqual([]);
      }
    });
  }

  test("a navegação principal funciona só com teclado", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterDemo(page);
    const link = page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Metas" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Metas", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Nova meta" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
