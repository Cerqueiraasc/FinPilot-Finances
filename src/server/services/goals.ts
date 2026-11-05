import { z } from "zod";
import { db } from "@/lib/db";
import { dateToISO, isoToDate, monthsBetween, todayISO } from "@/lib/dates";
import { notFound } from "@/lib/errors";
import { centsToNumber } from "@/lib/money";
import {
  averageMonthlyContribution,
  goalProgress,
  projectMonthsToGoal,
  requiredMonthly,
} from "@/features/goals/calculations";
import {
  createContributionSchema,
  createGoalSchema,
  updateGoalSchema,
} from "@/features/schemas";
import { audit } from "./audit";

export interface GoalDTO {
  id: string;
  title: string;
  description: string | null;
  targetCents: number;
  initialCents: number;
  dueDate: string | null;
  priority: number;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  savedCents: number;
  remainingCents: number;
  percent: number;
  averageMonthlyCents: number;
  estimatedMonths: number | null;
  requiredMonthlyCents: number | null;
  contributions: { id: string; amountCents: number; date: string; note: string | null }[];
}

export async function listGoals(
  userId: string,
  options: { onlyActive?: boolean } = {},
): Promise<GoalDTO[]> {
  const today = todayISO();
  const goals = await db.goal.findMany({
    where: { userId, ...(options.onlyActive ? { status: "ACTIVE" as const } : {}) },
    include: { contributions: { orderBy: [{ contributionDate: "desc" }, { id: "desc" }] } },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
  return goals.map((goal) => {
    const targetCents = centsToNumber(goal.targetCents);
    const initialCents = centsToNumber(goal.initialCents);
    const contributions = goal.contributions.map((item) => ({
      id: item.id,
      amountCents: centsToNumber(item.amountCents),
      date: dateToISO(item.contributionDate),
      note: item.note,
    }));
    const progress = goalProgress(
      targetCents,
      initialCents,
      contributions.map((item) => item.amountCents),
    );
    const averageMonthlyCents = averageMonthlyContribution(contributions, today);
    const dueDate = goal.dueDate ? dateToISO(goal.dueDate) : null;
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      targetCents,
      initialCents,
      dueDate,
      priority: goal.priority,
      status: goal.status,
      ...progress,
      averageMonthlyCents,
      estimatedMonths: projectMonthsToGoal(progress.remainingCents, averageMonthlyCents),
      requiredMonthlyCents: dueDate
        ? requiredMonthly(progress.remainingCents, monthsBetween(today, dueDate))
        : null,
      contributions,
    };
  });
}

export async function createGoal(
  userId: string,
  input: z.infer<typeof createGoalSchema>,
): Promise<{ id: string }> {
  const goal = await db.goal.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      targetCents: BigInt(input.targetCents),
      initialCents: BigInt(input.initialCents),
      dueDate: input.dueDate ? isoToDate(input.dueDate) : null,
      priority: input.priority,
    },
  });
  await audit(db, userId, "goal.create", "Goal", goal.id);
  return { id: goal.id };
}

export async function updateGoal(
  userId: string,
  goalId: string,
  input: z.infer<typeof updateGoalSchema>,
): Promise<void> {
  const { targetCents, initialCents, dueDate, ...rest } = input;
  const result = await db.goal.updateMany({
    where: { id: goalId, userId },
    data: {
      ...rest,
      ...(targetCents !== undefined ? { targetCents: BigInt(targetCents) } : {}),
      ...(initialCents !== undefined ? { initialCents: BigInt(initialCents) } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? isoToDate(dueDate) : null } : {}),
    },
  });
  if (result.count === 0) throw notFound("Meta");
  await audit(db, userId, "goal.update", "Goal", goalId);
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const result = await db.goal.deleteMany({ where: { id: goalId, userId } });
  if (result.count === 0) throw notFound("Meta");
  await audit(db, userId, "goal.delete", "Goal", goalId);
}

export async function addContribution(
  userId: string,
  goalId: string,
  input: z.infer<typeof createContributionSchema>,
): Promise<{ id: string }> {
  const goal = await db.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw notFound("Meta");
  if (input.linkedTransactionId) {
    const linked = await db.transaction.findFirst({
      where: { id: input.linkedTransactionId, userId },
    });
    if (!linked) throw notFound("Transação");
  }
  const contribution = await db.goalContribution.create({
    data: {
      userId,
      goalId,
      amountCents: BigInt(input.amountCents),
      contributionDate: isoToDate(input.contributionDate),
      note: input.note ?? null,
      linkedTransactionId: input.linkedTransactionId ?? null,
    },
  });
  await audit(db, userId, "goal_contribution.create", "GoalContribution", contribution.id);
  return { id: contribution.id };
}

export async function deleteContribution(userId: string, contributionId: string): Promise<void> {
  const result = await db.goalContribution.deleteMany({ where: { id: contributionId, userId } });
  if (result.count === 0) throw notFound("Aporte");
  await audit(db, userId, "goal_contribution.delete", "GoalContribution", contributionId);
}
