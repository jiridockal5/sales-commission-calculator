import type { CommissionPlan } from "@/lib/commission-engine/types";
import { createBlankPlan } from "@/lib/plan/planFactory";

export function createStartFromScratchPlan(name = "New plan"): CommissionPlan {
  return createBlankPlan(name);
}
