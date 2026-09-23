import { describe, expect, it } from "vitest";
import { calculateBonuses } from "../calculateBonuses";
import { calculateCommission } from "../calculateCommission";
import { getRampPct, rampAdjustedQuota } from "../calculateQuotaAttainment";
import type { CommissionPlan } from "../types";
import { createTier } from "@/lib/plan/planFactory";
import { createDemoPlan } from "@/lib/demo/demoPlan";
import { acceleratedPlan, makePlan, updateRule, withData } from "./helpers";

function withThreshold(actual: number): CommissionPlan {
  let plan = makePlan();
  plan = { ...plan, features: { ...plan.features, threshold: true } };
  plan = updateRule(plan, "new_arr", { baseRate: 10, thresholdPct: 50 });
  return withData(plan, "new_arr", "fy", 100_000, actual);
}

describe("thresholds", () => {
  it("pays nothing below the threshold", () => {
    const r = calculateCommission(withThreshold(40_000));
    expect(r.totals.commission).toBe(0);
    expect(r.periods[0].revenueTypes[0].belowThreshold).toBe(true);
  });

  it("pays according to rules once the threshold is met", () => {
    expect(calculateCommission(withThreshold(70_000)).totals.commission).toBe(7_000);
    expect(calculateCommission(withThreshold(50_000)).totals.commission).toBe(5_000);
  });

  it("does not let the threshold zero an advanced tier that has a rate", () => {
    let plan = makePlan();
    plan = { ...plan, configMode: "advanced", features: { ...plan.features, threshold: true } };
    plan = updateRule(plan, "new_arr", {
      thresholdPct: 50,
      tiers: [createTier(0, 50, 10), createTier(50, 100, 20), createTier(100, null, 30)],
    });
    plan = withData(plan, "new_arr", "fy", 100_000, 10_000);
    expect(calculateCommission(plan).totals.commission).toBe(1_000);
  });
});

describe("demo plan", () => {
  it("calculates the demo example", () => {
    const r = calculateCommission(createDemoPlan());
    // 1,000,000 * 10% + 150,000 * 15%
    expect(r.totals.commission).toBe(122_500);
    expect(r.totals.attainmentPct).toBe(115);
    expect(r.totals.effectiveRatePct).toBe(10.6522);
    expect(r.employerCost.totalCashCompensation).toBe(202_500);
    expect(r.totals.oteAttainmentPct).toBe(112.5);
  });
});

describe("caps", () => {
  it("caps payout per period", () => {
    let plan = createDemoPlan();
    plan = { ...plan, features: { ...plan.features, caps: true } };
    plan = updateRule(plan, "new_arr", { maxPayoutPerPeriod: 50_000 });
    const r = calculateCommission(plan);
    expect(r.totals.commission).toBe(50_000);
    expect(r.periods[0].revenueTypes[0].capReduction).toBe(72_500);
  });

  it("stops accelerating beyond the max attainment", () => {
    let plan = acceleratedPlan("marginal", 100_000, 300_000);
    plan = { ...plan, features: { ...plan.features, caps: true } };
    plan = updateRule(plan, "new_arr", { maxAttainmentPct: 200 });
    // 100k * 10% + 100k * 15%; the last 100k is ignored
    expect(calculateCommission(plan).totals.commission).toBe(25_000);
  });

  it("applies a total plan cap across periods", () => {
    let plan = makePlan({ period: "quarterly", mode: "multi" });
    plan = { ...plan, features: { ...plan.features, caps: true }, cap: { maxTotalPayout: 25_000 } };
    for (const q of ["q1", "q2", "q3", "q4"]) plan = withData(plan, "new_arr", q, 100_000, 100_000);
    const r = calculateCommission(plan);
    expect(r.periods.map((p) => p.commission)).toEqual([10_000, 10_000, 5_000, 0]);
    expect(r.totals.commission).toBe(25_000);
    expect(r.totals.planCapReduction).toBe(15_000);
  });

  it("is uncapped by default", () => {
    expect(calculateCommission(acceleratedPlan("marginal", 100_000, 1_000_000)).totals.commission).toBe(145_000);
  });
});

describe("bonuses", () => {
  const rules = [
    { id: "b1", planId: "p", attainmentPct: 100, amount: 2_000 },
    { id: "b2", planId: "p", attainmentPct: 125, amount: 3_000 },
    { id: "b3", planId: "p", attainmentPct: 150, amount: 5_000 },
  ];

  it("pays the bonus exactly at the milestone", () => {
    expect(calculateBonuses(100, rules).map((b) => b.amount)).toEqual([2_000]);
    expect(calculateBonuses(99.9999, rules)).toEqual([]);
  });

  it("stacks multiple milestones", () => {
    expect(calculateBonuses(125, rules).reduce((a, b) => a + b.amount, 0)).toBe(5_000);
    expect(calculateBonuses(180, rules).reduce((a, b) => a + b.amount, 0)).toBe(10_000);
  });

  it("adds bonuses to earned variable pay in the engine", () => {
    let plan = acceleratedPlan("marginal", 100_000, 125_000);
    plan = { ...plan, features: { ...plan.features, bonuses: true }, bonuses: rules };
    const r = calculateCommission(plan);
    expect(r.totals.commission).toBe(13_750);
    expect(r.totals.bonuses).toBe(5_000);
    expect(r.totals.earnedVariable).toBe(18_750);
  });

  it("evaluates annual bonuses on total attainment in the last period", () => {
    let plan = makePlan({ period: "quarterly", mode: "multi" });
    plan = { ...plan, features: { ...plan.features, bonuses: true }, bonuses: rules, bonusEvaluation: "annual" };
    const actuals = [90_000, 110_000, 100_000, 100_000];
    ["q1", "q2", "q3", "q4"].forEach((q, i) => (plan = withData(plan, "new_arr", q, 100_000, actuals[i])));
    const r = calculateCommission(plan);
    expect(r.periods.map((p) => p.bonusTotal)).toEqual([0, 0, 0, 2_000]);
  });
});

describe("ramp", () => {
  const ramp = {
    firstPeriodNumber: 1,
    steps: [
      { id: "r1", periodNumber: 1, pct: 25 },
      { id: "r2", periodNumber: 2, pct: 50 },
      { id: "r3", periodNumber: 3, pct: 75 },
    ],
  };

  it("resolves ramp percentages by tenure", () => {
    expect([0, 1, 2, 3, 11].map((p) => getRampPct(ramp, p))).toEqual([25, 50, 75, 100, 100]);
    expect(getRampPct({ ...ramp, firstPeriodNumber: 3 }, 0)).toBe(75);
    expect(rampAdjustedQuota(10_000, 25)).toBe(2_500);
  });

  it("uses the ramp-adjusted quota for attainment and shows full quota", () => {
    let plan = makePlan({ period: "monthly", mode: "multi" });
    plan = { ...plan, configMode: "advanced", features: { ...plan.features, ramp: true }, ramp };
    plan = updateRule(plan, "new_arr", { tiers: [createTier(0, 100, 10), createTier(100, null, 15)] });
    plan = withData(plan, "new_arr", "m1", 10_000, 5_000);
    const m1 = calculateCommission(plan).periods[0];
    expect(m1.fullQuota).toBe(10_000);
    expect(m1.quota).toBe(2_500);
    expect(m1.attainmentPct).toBe(200);
    // 2,500 * 10% + 2,500 * 15%
    expect(m1.commission).toBe(625);
  });
});
