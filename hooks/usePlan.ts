"use client";

import type { CommissionPlan } from "@/lib/commission-engine/types";
import { useActivePlan, usePlanStore } from "@/store/planStore";

/** Active plan + updater for pages rendered inside the hydrated app shell. */
export function usePlan(): { plan: CommissionPlan; update: (updater: (plan: CommissionPlan) => CommissionPlan) => void } {
  const plan = useActivePlan();
  const update = usePlanStore((s) => s.updateActivePlan);
  if (!plan) throw new Error("usePlan must be used inside a hydrated AppShell");
  return { plan, update };
}
