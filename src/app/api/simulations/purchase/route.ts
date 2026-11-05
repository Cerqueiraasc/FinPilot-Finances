import { purchaseSimulationSchema } from "@/features/schemas";
import { authedRoute } from "@/lib/api/handler";
import { runPurchaseSimulation } from "@/server/services/simulator";

export const POST = authedRoute({ schema: purchaseSimulationSchema }, async ({ userId, body }) =>
  runPurchaseSimulation(userId, body),
);
