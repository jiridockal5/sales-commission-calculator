import { describe, expect, it } from "vitest";
import { calculateCommission } from "../calculateCommission";
import { calculateDraw } from "../calculateDraw";
import { calculateGuarantee } from "../calculateGuarantee";
import { calculatePayoutSchedule } from "../calculatePayoutSchedule";
import { calculateSplitCommission, validateSplits } from "../calculateSplitCommission";
import { generatePeriods } from "../periods";
import { acceleratedPlan, makePlan, withData } from "./helpers";

describe("guaranteed commission", () => {
  it("tops up to the guaranteed amount", () => {
    expect(calculateGuarantee(500, 2_000, true)).toBe(1_500);
    expect(calculateGuarantee(2_500, 2_000, true)).toBe(0);
    expect(calculateGuarantee(500, 2_000, false)).toBe(0);
  });

  it("applies only to ramp periods when configured", () => {
    let plan = makePlan({ period: "monthly", mode: "multi" });
    plan = {
      ...plan,
      features: { ...plan.features, ramp: true, guarantee: true },
      ramp: { firstPeriodNumber: 1, steps: [{ id: "r1", periodNumber: 1, pct: 50 }] },
      guarantee: { amountPerPeriod: 2_000, appliesTo: "ramp_periods" },
    };
    plan = withData(plan, "new_arr", "m1", 10_000, 5_000);
    plan = withData(plan, "new_arr", "m2", 10_000, 5_000);
    const r = calculateCommission(plan);
    expect(r.periods[0].commission).toBe(500);
    expect(r.periods[0].guaranteeTopUp).toBe(1_500);
    expect(r.periods[0].payout).toBe(2_000);
    expect(r.periods[1].guaranteeTopUp).toBe(0);
    expect(r.periods[1].payout).toBe(500);
  });
});

describe("draw against commission", () => {
  it("recoverable draw carries the shortfall forward", () => {
    const r = calculateDraw([2_000, 5_000, 5_000], { type: "recoverable", amountPerPeriod: 3_000 });
    expect(r.payouts).toEqual([3_000, 4_000, 5_000]);
    expect(r.entries.map((e) => e.balanceAfter)).toEqual([1_000, 0, 0]);
    expect(r.entries[0].advance).toBe(1_000);
    expect(r.entries[1].recovery).toBe(1_000);
  });

  it("recovery never drops payout below the draw", () => {
    const r = calculateDraw([0, 3_500, 10_000], { type: "recoverable", amountPerPeriod: 3_000 });
    expect(r.payouts).toEqual([3_000, 3_000, 7_500]);
    expect(r.endingBalance).toBe(0);
  });

  it("non-recoverable draw forgives the shortfall", () => {
    const r = calculateDraw([2_000, 5_000], { type: "non_recoverable", amountPerPeriod: 3_000 });
    expect(r.payouts).toEqual([3_000, 5_000]);
    expect(r.entries[0].forgiven).toBe(1_000);
    expect(r.endingBalance).toBe(0);
  });

  it("pays earnings in full when above the draw", () => {
    expect(calculateDraw([5_000], { type: "recoverable", amountPerPeriod: 3_000 }).payouts).toEqual([5_000]);
  });

  it("carries negative earnings forward without a draw", () => {
    const r = calculateDraw([-1_000, 3_000], null);
    expect(r.payouts).toEqual([0, 2_000]);
  });
});

describe("clawbacks", () => {
  it("deducts aggregated clawbacks using rule percentages", () => {
    let plan = acceleratedPlan("marginal", 100_000, 100_000);
    plan = {
      ...plan,
      features: { ...plan.features, clawbacks: true },
      clawbackRules: [
        { id: "c90", planId: plan.id, trigger: "churn", withinDays: 90, pct: 100 },
        { id: "c180", planId: plan.id, trigger: "churn", withinDays: 180, pct: 50 },
      ],
      clawbackEntries: [
        { id: "e1", planId: plan.id, periodId: "fy", clawbackRuleId: "c90", commissionAmount: 1_000, note: "" },
        { id: "e2", planId: plan.id, periodId: "fy", clawbackRuleId: "c180", commissionAmount: 3_500, note: "" },
        { id: "e3", planId: plan.id, periodId: "fy", clawbackRuleId: null, commissionAmount: 250, note: "" },
      ],
    };
    const r = calculateCommission(plan);
    expect(r.totals.clawbacks).toBe(3_000);
    expect(r.totals.earnedVariable).toBe(7_000);
    expect(r.totals.payout).toBe(7_000);
  });
});

describe("split commission", () => {
  const splits = [
    { id: "ae", planId: "p", role: "Account Executive", pct: 70 },
    { id: "sdr", planId: "p", role: "SDR", pct: 20 },
    { id: "se", planId: "p", role: "Sales Engineer", pct: 10 },
  ];

  it("splits the pool by role", () => {
    const r = calculateSplitCommission(10_000, splits);
    expect(r.valid).toBe(true);
    expect(r.lines.map((l) => l.amount)).toEqual([7_000, 2_000, 1_000]);
  });

  it("assigns rounding remainders so lines reconcile", () => {
    const r = calculateSplitCommission(100.01, [
      { id: "a", planId: "p", role: "A", pct: 33.33 },
      { id: "b", planId: "p", role: "B", pct: 33.33 },
      { id: "c", planId: "p", role: "C", pct: 33.34 },
    ]);
    const total = r.lines.reduce((acc, l) => acc + Math.round(l.amount * 100), 0);
    expect(total).toBe(10_001);
  });

  it("validates that splits equal 100%", () => {
    expect(validateSplits(splits)).toEqual([]);
    expect(validateSplits(splits.slice(0, 2))[0]).toMatch(/100%/);
    expect(calculateSplitCommission(1_000, splits.slice(0, 2)).valid).toBe(false);
  });
});

describe("payout frequency", () => {
  it("groups monthly calculation into quarterly payouts", () => {
    const periods = generatePeriods("p", "monthly");
    const groups = calculatePayoutSchedule(periods, Array(12).fill(1_000.005), "quarterly");
    expect(groups.map((g) => g.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(groups[0].payout).toBe(3_000.03);
  });

  it("never pays more often than it calculates", () => {
    const periods = generatePeriods("p", "quarterly");
    expect(calculatePayoutSchedule(periods, [1, 2, 3, 4], "monthly").map((g) => g.label)).toEqual([
      "Q1",
      "Q2",
      "Q3",
      "Q4",
    ]);
  });
});
