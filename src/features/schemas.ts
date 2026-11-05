import { z } from "zod";
import {
  idSchema,
  isoDateSchema,
  nonNegativeCentsSchema,
  optionalTextSchema,
  paginationSchema,
  positiveCentsSchema,
  signedCentsSchema,
} from "@/lib/validators/common";

// Auth
const passwordSchema = z
  .string()
  .min(10, "Use ao menos 10 caracteres")
  .max(200, "Use no máximo 200 caracteres");
const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "É preciso aceitar os termos e a política de privacidade" }),
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha").max(200),
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual").max(200),
  newPassword: passwordSchema,
});

// Perfil e onboarding
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  financialMonthStartDay: z.number().int().min(1, "Use um dia de 1 a 28").max(28, "Use um dia de 1 a 28"),
  estimatedIncomeCents: nonNegativeCentsSchema.nullable(),
  minReserveCents: nonNegativeCentsSchema.nullable(),
});
export const onboardingSchema = profileSchema.omit({ name: true }).extend({
  accountName: z.string().trim().min(1, "Informe o nome da conta").max(60),
  openingBalanceCents: signedCentsSchema,
  goalTitle: optionalTextSchema(100),
  goalTargetCents: positiveCentsSchema.nullish(),
});
export const aiPreferenceSchema = z.object({ enabled: z.boolean() });
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha").max(200),
  confirmation: z.literal("EXCLUIR", { error: 'Digite "EXCLUIR" para confirmar' }),
});

// Contas
export const accountTypeSchema = z.enum(["CHECKING", "SAVINGS", "CASH"]);
export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da conta").max(60),
  type: accountTypeSchema,
  institution: optionalTextSchema(60),
  openingBalanceCents: signedCentsSchema,
  color: optionalTextSchema(20),
});
export const updateAccountSchema = createAccountSchema.partial().extend({
  archived: z.boolean().optional(),
});

// Categorias e regras
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(40),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: optionalTextSchema(20),
});
export const createRuleSchema = z.object({
  matchType: z.enum(["CONTAINS", "STARTS_WITH", "EQUALS"]),
  pattern: z.string().trim().min(2, "Informe ao menos 2 caracteres").max(80),
  categoryId: idSchema,
  priority: z.number().int().min(1).max(1000).default(100),
});

// Transações
const entryTypeSchema = z.enum(["INCOME", "EXPENSE", "REFUND"]);
const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(10).default([]);
const descriptionSchema = z.string().trim().min(1, "Informe a descrição").max(200);
export const createTransactionSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema.nullish(),
  type: entryTypeSchema,
  amountCents: positiveCentsSchema,
  description: descriptionSchema,
  transactionDate: isoDateSchema,
  status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
  notes: optionalTextSchema(500),
  tags: tagsSchema,
});
export const updateTransactionSchema = createTransactionSchema
  .partial()
  .extend({ status: z.enum(["PENDING", "POSTED", "CANCELED"]).optional() });
export const transactionFiltersSchema = paginationSchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  type: z.enum(["INCOME", "EXPENSE", "REFUND", "TRANSFER"]).optional(),
  status: z.enum(["PENDING", "POSTED", "CANCELED"]).optional(),
  search: z.string().trim().max(100).optional(),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const createTransferSchema = z
  .object({
    fromAccountId: idSchema,
    toAccountId: idSchema,
    amountCents: positiveCentsSchema,
    transferDate: isoDateSchema,
    description: z.string().trim().max(200).default("Transferência entre contas"),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Escolha contas diferentes",
    path: ["toAccountId"],
  });

// Recorrências
export const createRecurrenceSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema.nullish(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amountCents: positiveCentsSchema,
  description: descriptionSchema,
  notes: optionalTextSchema(500),
  tags: tagsSchema,
  cadence: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullish(),
});
export const updateRecurrenceSchema = z.object({
  amountCents: positiveCentsSchema.optional(),
  description: descriptionSchema.optional(),
  categoryId: idSchema.nullish(),
  active: z.boolean().optional(),
  endDate: isoDateSchema.nullish(),
});

// Orçamentos
export const createBudgetSchema = z.object({
  categoryId: idSchema,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  limitCents: positiveCentsSchema,
});
export const updateBudgetSchema = z.object({ limitCents: positiveCentsSchema });

// Metas
export const createGoalSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(100),
  description: optionalTextSchema(500),
  targetCents: positiveCentsSchema,
  initialCents: nonNegativeCentsSchema.default(0),
  dueDate: isoDateSchema.nullish(),
  priority: z.number().int().min(1).max(3).default(2),
});
export const updateGoalSchema = createGoalSchema
  .partial()
  .extend({ status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional() });
export const createContributionSchema = z.object({
  amountCents: signedCentsSchema.refine((value) => value !== 0, "O valor não pode ser zero"),
  contributionDate: isoDateSchema,
  note: optionalTextSchema(200),
  linkedTransactionId: idSchema.nullish(),
});

// Importação
const mappingSchema = z.object({
  date: z.number().int().min(0),
  description: z.number().int().min(0),
  amount: z.number().int().min(0),
  externalId: z.number().int().min(0).nullish(),
});
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const importPreviewSchema = z.object({
  accountId: idSchema,
  filename: z.string().trim().min(1).max(200),
  csvText: z.string().min(1, "O arquivo está vazio").max(IMPORT_MAX_BYTES, "Arquivo acima de 2 MB"),
  mapping: mappingSchema.optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"]).default("DD/MM/YYYY"),
});
export const importCommitSchema = importPreviewSchema.extend({
  mapping: mappingSchema,
  decisions: z
    .array(
      z.object({
        rowIndex: z.number().int().min(0),
        include: z.boolean(),
        categoryId: idSchema.nullish(),
      }),
    )
    .max(20000),
});

// Simulador
export const purchaseSimulationSchema = z.object({
  amountCents: positiveCentsSchema,
  categoryId: idSchema,
  paymentMethod: z.literal("CASH").default("CASH"),
  plannedDate: isoDateSchema,
  essential: z.boolean(),
  note: optionalTextSchema(200),
});

// Assistente
export const assistantExplainSchema = z.object({
  question: z.string().trim().min(2, "Escreva sua pergunta").max(500).optional(),
});

// Relatórios
export const reportFiltersSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
});
