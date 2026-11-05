import "dotenv/config";
import { db } from "../src/lib/db";
import { addDays, addMonths, isoToDate, todayISO } from "../src/lib/dates";
import { hashPassword } from "../src/lib/security/password";
import { hashForEntry } from "../src/server/services/transactions";
import { ensureDefaultCategories } from "../src/server/services/categories";
import { CURRENT_CONSENT_VERSION } from "../src/server/services/consent";

/** Apenas para ambiente local: credenciais e valores são fictícios. */
const DEMO_EMAIL = "demo@finpilot.local";
const DEMO_PASSWORD = "demo-finpilot-123";

async function seedDemoUser() {
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const today = todayISO();
  const thisMonthFirst = `${today.slice(0, 7)}-01`;

  const user = await db.user.create({
    data: {
      name: "Pessoa Demonstração",
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      emailVerifiedAt: new Date(),
      isDemo: true,
      onboardedAt: new Date(),
      estimatedIncomeCents: BigInt(650000),
      minReserveCents: BigInt(200000),
      consents: {
        create: [
          { purpose: "TERMS", version: CURRENT_CONSENT_VERSION },
          { purpose: "PRIVACY_POLICY", version: CURRENT_CONSENT_VERSION },
        ],
      },
    },
  });
  const userId = user.id;

  const checking = await db.account.create({
    data: {
      userId,
      name: "Conta corrente (fictícia)",
      type: "CHECKING",
      institution: "Banco fictício",
      openingBalanceCents: BigInt(320000),
    },
  });
  const savings = await db.account.create({
    data: {
      userId,
      name: "Poupança (fictícia)",
      type: "SAVINGS",
      institution: "Banco fictício",
      openingBalanceCents: BigInt(450000),
    },
  });

  type Entry = [day: number, type: "INCOME" | "EXPENSE", cents: number, category: string, text: string];
  const monthly: Entry[] = [
    [5, "INCOME", 650000, "cat_salario", "Salário empresa fictícia"],
    [6, "EXPENSE", 180000, "cat_moradia", "Aluguel"],
    [7, "EXPENSE", 42000, "cat_moradia", "Energia e internet"],
    [8, "EXPENSE", 58000, "cat_alimentacao", "Supermercado"],
    [10, "EXPENSE", 3990, "cat_assinaturas", "Streaming de vídeo"],
    [11, "EXPENSE", 18000, "cat_transporte", "Combustível"],
    [12, "EXPENSE", 9900, "cat_saude", "Academia"],
    [14, "EXPENSE", 34000, "cat_alimentacao", "Restaurantes"],
    [16, "EXPENSE", 26000, "cat_lazer", "Cinema e passeios"],
  ];

  const rows = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const monthFirst = addMonths(thisMonthFirst, offset);
    for (const [day, type, cents, categoryId, description] of monthly) {
      // No mês atual, o que cairia no futuro entra hoje, para o painel nunca abrir zerado.
      const planned = addDays(monthFirst, day - 1);
      const date = planned > today ? today : planned;
      // Pequena variação determinística para os gráficos não ficarem planos.
      const varies = categoryId === "cat_alimentacao" || categoryId === "cat_lazer";
      const amountCents = varies ? cents + (offset + 7) * 1700 : cents;
      rows.push({
        userId,
        accountId: checking.id,
        categoryId,
        type,
        amountCents: BigInt(amountCents),
        description,
        transactionDate: isoToDate(date),
        status: "POSTED" as const,
        source: "MANUAL" as const,
        tags: ["demo"],
        dedupeHash: hashForEntry({ accountId: checking.id, date, type, amountCents, description }),
      });
    }
  }
  await db.transaction.createMany({ data: rows });

  const { createTransfer } = await import("../src/server/services/transactions");
  await createTransfer(userId, {
    fromAccountId: checking.id,
    toAccountId: savings.id,
    amountCents: 50000,
    transferDate: addDays(today, -1),
    description: "Reserva mensal",
  });

  const [year, month] = today.split("-").map(Number);
  const { createBudget } = await import("../src/server/services/budgets");
  // Lazer começa abaixo de 80%: uma despesa pequena dispara o alerta durante a apresentação.
  await createBudget(userId, { categoryId: "cat_lazer", year, month, limitCents: 50000 });
  await createBudget(userId, { categoryId: "cat_alimentacao", year, month, limitCents: 120000 });
  await createBudget(userId, { categoryId: "cat_transporte", year, month, limitCents: 30000 });

  await db.goal.create({
    data: {
      userId,
      title: "Viagem de férias",
      targetCents: BigInt(800000),
      initialCents: BigInt(50000),
      dueDate: isoToDate(addMonths(today, 10)),
      priority: 1,
      contributions: {
        create: [-2, -1, 0].map((offset) => ({
          userId,
          amountCents: BigInt(40000),
          contributionDate: isoToDate(addDays(addMonths(thisMonthFirst, offset), 4)),
          note: "Aporte virtual",
        })),
      },
    },
  });
  await db.goal.create({
    data: {
      userId,
      title: "Reserva de emergência",
      targetCents: BigInt(1500000),
      initialCents: BigInt(450000),
      priority: 2,
    },
  });

  await db.categoryRule.create({
    data: { userId, matchType: "CONTAINS", pattern: "supermercado", categoryId: "cat_alimentacao", priority: 10 },
  });

  console.info(`Usuário de demonstração criado: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (somente local)`);
}

async function main() {
  await ensureDefaultCategories();
  console.info("Categorias padrão garantidas.");
  if (process.env.NODE_ENV === "production") {
    console.info("Produção: dados de demonstração não são criados.");
    return;
  }
  await seedDemoUser();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
