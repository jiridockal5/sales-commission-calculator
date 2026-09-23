import { generatePeriods } from "../periods";
import type { CommissionPlan, CommissionRule, PeriodType, RevenueTypeKey } from "../types";
import { createBlankPlan, createTier, revenueTypeByKey, setPerformance, setQuota } from "@/lib/plan/planFactory";

export interface TestPlanOptions {
  period?: PeriodType;
  mode?: "single" | "multi";
  enabled?: RevenueTypeKey[];
}

export function makePlan(options: TestPlanOptions = {}): CommissionPlan {
  const blank = createBlankPlan("Test");
  const period = options.period ?? "annual";
  const enabled = options.enabled ?? ["new_arr"];
  return {
    ...blank,
    calculationPeriod: period,
    payoutFrequency: period,
    mode: options.mode ?? "single",
    periods: generatePeriods(blank.id, period),
    revenueTypes: blank.revenueTypes.map((rt) => ({ ...rt, enabled: enabled.includes(rt.key) })),
  };
}

export function updateRule(plan: CommissionPlan, key: RevenueTypeKey, patch: Partial<CommissionRule>): CommissionPlan {
  const rt = revenueTypeByKey(plan, key);
  return { ...plan, rules: plan.rules.map((r) => (r.revenueTypeId === rt.id ? { ...r, ...patch } : r)) };
}

export function withData(
  plan: CommissionPlan,
  key: RevenueTypeKey,
  periodId: string,
  quota: number | null,
  actual: number,
  scope: "individual" | "team" = "individual",
): CommissionPlan {
  const rt = revenueTypeByKey(plan, key);
  let next = plan;
  if (quota !== null) next = setQuota(next, periodId, rt.id, quota, scope);
  return setPerformance(next, periodId, rt.id, { actual }, scope);
}

/** Simple plan: tiers 0-100% at 10%, 100%+ at 15%. */
export function acceleratedPlan(method: "marginal" | "retroactive", quota: number, actual: number): CommissionPlan {
  let plan = makePlan();
  plan = { ...plan, configMode: "advanced" };
  plan = updateRule(plan, "new_arr", {
    accelerationMethod: method,
    tiers: [createTier(0, 100, 10), createTier(100, null, 15)],
  });
  return withData(plan, "new_arr", "fy", quota, actual);
}
