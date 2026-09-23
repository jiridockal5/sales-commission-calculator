import { describe, expect, it } from "vitest";
import { calculateCommission } from "../calculateCommission";
import { calculateOTE } from "../calculateOTE";
import { calculatePayoutCurve } from "../calculatePayoutCurve";
import { calculatePlanComparison } from "../calculatePlanComparison";
import { money, round2 } from "../money";
import { createTier, setPerformance, revenueTypeByKey } from "@/lib/plan/planFactory";
import { createDemoPlan } from "@/lib/demo/demoPlan";
import { acceleratedPlan, makePlan, updateRule, withData } from "./helpers";

describe("multiple revenue types", () => {
  it("calculates each type with its own quota and rate", () => {
    let plan = makePlan({ period: "quarterly", enabled: ["new_arr", "expansion", "renewal", "one_time"] });
    plan = updateRule(plan, "new_arr", { baseRate: 10 });
    plan = updateRule(plan, "expansion", { baseRate: 7 });
    plan = updateRule(plan, "renewal", { baseRate: 2 });
    plan = updateRule(plan, "one_time", { baseRate: 5 });
    plan = withData(plan, "new_arr", "q1", 100_000, 85_000);
    plan = withData(plan, "expansion", "q1", 30_000, 18_000);
    plan = withData(plan, "renewal", "q1", null, 120_000);
    plan = withData(plan, "one_time", "q1", null, 5_000);
    const r = calculateCommission(plan);
    expect(r.byRevenueType.map((t) => [t.label, t.amount])).toEqual([
      ["New ARR", 8_500],
      ["One-time revenue", 250],
      ["Expansion ARR", 1_260],
      ["Renewal ARR", 2_400],
    ]);
    expect(r.totals.commission).toBe(12_410);
    // Attainment only counts quota-based types: 103k / 130k
    expect(r.totals.attainmentPct).toBe(79.2308);
    // 12,410 / 228,000 commissionable revenue
    expect(r.totals.effectiveRatePct).toBe(5.443);
  });

  it("applies credit weighting and renewal in-period exclusions", () => {
    let plan = makePlan({ enabled: ["new_arr", "renewal"] });
    plan = {
      ...plan,
      revenueTypes: plan.revenueTypes.map((rt) => (rt.key === "new_arr" ? { ...rt, weighting: 50 } : rt)),
    };
    plan = updateRule(plan, "new_arr", { baseRate: 10 });
    plan = updateRule(plan, "renewal", { baseRate: 2, requireInPeriod: true });
    plan = withData(plan, "new_arr", "fy", 100_000, 100_000);
    plan = setPerformance(plan, "fy", revenueTypeByKey(plan, "renewal").id, { actual: 100_000, excludedAmount: 40_000 });
    const r = calculateCommission(plan);
    expect(r.periods[0].attainmentPct).toBe(50);
    expect(r.byRevenueType.map((t) => t.amount)).toEqual([5_000, 1_200]);
  });
});

describe("team + individual weighting", () => {
  it("weights individual commission and pays team share of target variable by team payout factor", () => {
    let plan = acceleratedPlan("marginal", 100_000, 100_000);
    plan = {
      ...plan,
      features: { ...plan.features, team: true },
      team: { individualWeight: 70, teamWeight: 30 },
      ote: { baseSalary: 80_000, targetVariable: 100_000, employerOverheadPct: 0 },
    };
    plan = withData(plan, "new_arr", "fy", 1_000_000, 1_200_000, "team");
    const r = calculateCommission(plan);
    const p = r.periods[0];
    expect(p.individualCommission).toBe(7_000);
    // team: (100k + 200k*15%) / 100k = 1.3 factor; 100k * 30% * 1.3
    expect(p.team?.payoutFactor).toBe(1.3);
    expect(p.teamCommission).toBe(39_000);
    expect(r.totals.commission).toBe(46_000);
  });

  it("warns when weights do not total 100%", () => {
    let plan = acceleratedPlan("marginal", 100_000, 100_000);
    plan = { ...plan, features: { ...plan.features, team: true }, team: { individualWeight: 70, teamWeight: 20 } };
    expect(calculateCommission(plan).warnings.join(" ")).toMatch(/100%/);
  });
});

describe("decimal precision", () => {
  it("avoids floating point errors", () => {
    let plan = makePlan({ enabled: ["new_arr", "one_time"] });
    plan = updateRule(plan, "one_time", { baseRate: 100 });
    plan = updateRule(plan, "new_arr", { baseRate: 100 });
    plan = withData(plan, "new_arr", "fy", 0, 0.1);
    plan = withData(plan, "one_time", "fy", null, 0.2);
    const r = calculateCommission(plan);
    expect(r.totals.commission).toBe(0.3);
    expect(r.totals.actual).toBe(0.3);
  });

  it("rounds half-up to cents consistently", () => {
    expect(money(1.005)).toBe(1.01);
    expect(money(2.675)).toBe(2.68);
    expect(round2("123.4565").toNumber()).toBe(123.46);
    const r = calculateCommission(acceleratedPlan("marginal", 100_000, 1_234.565));
    expect(r.totals.commission).toBe(123.46);
  });

  it("handles decimal quotas and actuals", () => {
    const r = calculateCommission(acceleratedPlan("marginal", 33_333.33, 44_444.44));
    // 33,333.33 * 10% + 11,111.11 * 15% = 3,333.333 + 1,666.6665
    expect(r.totals.commission).toBe(5_000);
  });
});

describe("very large values", () => {
  it("stays exact for trillions", () => {
    const r = calculateCommission(acceleratedPlan("marginal", 1_000_000_000_000, 1_500_000_000_000));
    expect(r.totals.commission).toBe(175_000_000_000);
    const retro = calculateCommission(acceleratedPlan("retroactive", 1_000_000_000_000, 1_500_000_000_000.55));
    expect(retro.totals.commission).toBe(225_000_000_000.08);
  });
});

describe("multi period", () => {
  it("calculates each period independently and totals the year", () => {
    let plan = makePlan({ period: "quarterly", mode: "multi" });
    plan = { ...plan, configMode: "advanced" };
    plan = updateRule(plan, "new_arr", { tiers: [createTier(0, 100, 10), createTier(100, null, 15)] });
    const data = [
      ["q1", 100_000, 90_000],
      ["q2", 110_000, 120_000],
      ["q3", 120_000, 140_000],
      ["q4", 130_000, 150_000],
    ] as const;
    for (const [q, quota, actual] of data) plan = withData(plan, "new_arr", q, quota, actual);
    const r = calculateCommission(plan);
    expect(r.periods.map((p) => p.commission)).toEqual([9_000, 12_500, 15_000, 16_000]);
    expect(r.totals.commission).toBe(52_500);
    expect(r.totals.quota).toBe(460_000);
    expect(r.totals.actual).toBe(500_000);
  });

  it("single mode only calculates the selected period", () => {
    let plan = makePlan({ period: "quarterly", mode: "single" });
    plan = { ...plan, singlePeriodIndex: 2 };
    plan = withData(plan, "new_arr", "q1", 100_000, 50_000);
    plan = withData(plan, "new_arr", "q3", 100_000, 115_000);
    const r = calculateCommission(plan);
    expect(r.periods).toHaveLength(1);
    expect(r.periods[0].label).toBe("Q3");
    expect(r.totals.commission).toBe(11_500);
  });
});

describe("OTE and payout curve", () => {
  it("computes OTE scenarios", () => {
    const ote = calculateOTE(createDemoPlan());
    expect(ote.ote).toBe(180_000);
    expect(ote.scenarios.map((s) => s.variable)).toEqual([50_000, 75_000, 100_000, 137_500, 187_500]);
    expect(ote.scenarios[2].totalCompensation).toBe(180_000);
    expect(ote.scenarios[2].pctOfTargetVariable).toBe(100);
  });

  it("produces a payout curve with highlighted points", () => {
    const curve = calculatePayoutCurve(createDemoPlan());
    const at = (a: number) => curve.find((p) => p.attainmentPct === a)?.payout;
    expect(at(0)).toBe(0);
    // The 0–100% tier is 10%, so attainment below 50% is paid. A 0% tier is what withholds commission.
    expect(at(47.5)).toBe(47_500);
    expect(at(50)).toBe(50_000);
    expect(at(100)).toBe(100_000);
    expect(at(200)).toBe(100_000 + 25_000 * 1.5 + 75_000 * 2);
  });
});

describe("plan comparison", () => {
  it("compares plans side by side", () => {
    const a = acceleratedPlan("marginal", 100_000, 120_000);
    const b = acceleratedPlan("retroactive", 100_000, 120_000);
    const result = calculatePlanComparison([a, b]);
    expect(result.entries.map((e) => e.totalCommission)).toEqual([13_000, 18_000]);
    expect(result.payoutCurves[0]).toHaveProperty(a.id);
    expect(result.payoutCurves[0]).toHaveProperty(b.id);
    expect(result.periodLabels).toEqual(["FY"]);
  });
});
