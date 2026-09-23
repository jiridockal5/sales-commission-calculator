import { generatePeriods, periodId } from "@/lib/commission-engine/periods";
import type { CommissionPlan } from "@/lib/commission-engine/types";
import { createBlankPlan, createTier, revenueTypeByKey, setPerformance, setQuota } from "@/lib/plan/planFactory";

/**
 * Demo: annual New ARR quota of $1M, nothing paid below 50% attainment, then
 * 10% up to quota, 15% from 100–125% and 20% above 125% (marginal). $1.15M actual.
 */
export function createDemoPlan(): CommissionPlan {
  const blank = createBlankPlan("Current Plan");
  const newArr = revenueTypeByKey(blank, "new_arr");
  let plan: CommissionPlan = {
    ...blank,
    description: "Demo plan: annual New ARR quota with tiered accelerators.",
    calculationPeriod: "annual",
    payoutFrequency: "annual",
    mode: "single",
    singlePeriodIndex: 0,
    configMode: "advanced",
    periods: generatePeriods(blank.id, "annual"),
    features: { ...blank.features, accelerators: true, threshold: true },
    rules: blank.rules.map((rule) =>
      rule.revenueTypeId === newArr.id
        ? {
            ...rule,
            baseRate: 10,
            acceleratorFromPct: 100,
            acceleratorRate: 15,
            thresholdPct: 50,
            tiers: [createTier(0, 100, 10), createTier(100, 125, 15), createTier(125, null, 20)],
          }
        : rule,
    ),
    ote: { baseSalary: 80000, targetVariable: 100000, employerOverheadPct: 0 },
  };
  const fy = periodId("annual", 0);
  plan = setQuota(plan, fy, newArr.id, 1_000_000);
  plan = setPerformance(plan, fy, newArr.id, { actual: 1_150_000 });
  return plan;
}
