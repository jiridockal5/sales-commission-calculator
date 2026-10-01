import { describe, expect, it } from "vitest";
import { annualQuota, userPlanBenchmark } from "@/lib/benchmarks/saasAeBenchmark";
import { calculateCommission } from "../calculateCommission";
import { explainCalculation } from "../explainCalculation";
import type { CommissionPlan } from "../types";
import { makePlan, updateRule, withData } from "./helpers";

/** The plan from the Compensation question: CZK, annual, marginal, accelerator from 50% at 50%. */
function planAt(actual: number): CommissionPlan {
  let plan = makePlan();
  plan = {
    ...plan,
    currency: "CZK",
    configMode: "simple",
    features: { ...plan.features, accelerators: true, threshold: true, caps: false },
    ote: { baseSalary: 1_800_000, targetVariable: 600_000, employerOverheadPct: 0 },
  };
  plan = updateRule(plan, "new_arr", {
    accelerationMethod: "marginal",
    baseRate: 10,
    acceleratorFromPct: 50,
    acceleratorRate: 50,
    thresholdPct: 25,
  });
  return withData(plan, "new_arr", "fy", 1_200_000, actual);
}

function explain(plan: CommissionPlan) {
  return explainCalculation(plan, calculateCommission(plan));
}

describe("explainCalculation", () => {
  it("shows 600,000 at 10% and an empty accelerator band when actual sits on the 50% line", () => {
    const plan = planAt(600_000);
    const before = JSON.stringify(plan);
    const result = calculateCommission(plan);
    const explained = explainCalculation(plan, result);

    expect(JSON.stringify(plan)).toBe(before);
    expect(result.totals.commission).toBe(60_000);
    expect(result.totals.earnedVariable).toBe(60_000);

    expect(explained.annualBase).toBe(1_800_000);
    expect(explained.annualTargetVariable).toBe(360_000);
    expect(explained.annualOte).toBe(2_160_000);
    expect(explained.annualQuota).toBe(1_200_000);
    expect(explained.annualQuota).toBe(annualQuota(plan));
    expect(explained.rateAtQuotaPct).toBe(30);
    expect(explained.rateAtQuotaPct).toBe(userPlanBenchmark(plan).rateAtQuotaPct);

    expect(explained.periods).toHaveLength(1);
    const period = explained.periods[0];
    expect(period.label).toBe("FY");
    expect(period.periodTypeLabel).toBe("Annual");
    expect(period.yearFractionLabel).toBe("1");
    expect(period.baseSalary).toBe(1_800_000);
    expect(period.quota).toBe(1_200_000);
    expect(period.actual).toBe(600_000);
    expect(period.attainmentPct).toBe(50);
    expect(period.variableEarned).toBe(60_000);
    expect(period.totalCash).toBe(1_860_000);

    const type = period.revenueTypes[0];
    expect(type.belowThreshold).toBe(false);
    expect(type.thresholdPct).toBe(25);
    expect(type.method).toBe("marginal");
    expect(type.commission).toBe(60_000);
    expect(type.slices).toHaveLength(2);
    expect(type.slices[0]).toMatchObject({
      fromPct: 0,
      toPct: 50,
      rate: 10,
      revenue: 600_000,
      commission: 60_000,
      empty: false,
      acceleratorBand: false,
      emptyNote: null,
    });
    expect(type.slices[1]).toMatchObject({
      fromPct: 50,
      toPct: null,
      rate: 50,
      revenue: 0,
      commission: 0,
      empty: true,
      acceleratorBand: true,
      emptyNote: "Accelerator band is empty",
    });
  });

  it("pays 0 and does not walk tiers when attainment is below the threshold", () => {
    const explained = explain(planAt(240_000));
    const period = explained.periods[0];
    const type = period.revenueTypes[0];

    expect(period.attainmentPct).toBe(20);
    expect(type.belowThreshold).toBe(true);
    expect(type.thresholdPct).toBe(25);
    expect(type.commission).toBe(0);
    expect(type.slices).toEqual([]);
    expect(period.variableEarned).toBe(0);
    expect(period.totalCash).toBe(1_800_000);
  });

  it("splits revenue into the base band and the accelerator band above the line", () => {
    const explained = explain(planAt(900_000));
    const type = explained.periods[0].revenueTypes[0];

    expect(explained.periods[0].attainmentPct).toBe(75);
    expect(type.belowThreshold).toBe(false);
    expect(type.slices).toHaveLength(2);
    expect(type.slices[0]).toMatchObject({ revenue: 600_000, rate: 10, commission: 60_000, empty: false });
    expect(type.slices[1]).toMatchObject({
      fromPct: 50,
      rate: 50,
      revenue: 300_000,
      commission: 150_000,
      empty: false,
      acceleratorBand: false,
      emptyNote: null,
    });
    expect(type.commission).toBe(210_000);
    expect(explained.periods[0].variableEarned).toBe(210_000);
    expect(explained.periods[0].totalCash).toBe(2_010_000);
  });

  it("uses one retroactive rate on all revenue once the accelerator line is reached", () => {
    let plan = planAt(600_000);
    plan = updateRule(plan, "new_arr", { accelerationMethod: "retroactive" });
    const type = explain(plan).periods[0].revenueTypes[0];

    expect(type.method).toBe("retroactive");
    expect(type.commission).toBe(300_000);
    expect(type.slices).toHaveLength(1);
    expect(type.slices[0]).toMatchObject({
      revenue: 600_000,
      rate: 50,
      commission: 300_000,
      appliesToAll: true,
      empty: false,
    });
  });

  it("keeps an empty accelerator band when retroactive attainment is still in the base band", () => {
    let plan = planAt(480_000);
    plan = updateRule(plan, "new_arr", { accelerationMethod: "retroactive" });
    const slices = explain(plan).periods[0].revenueTypes[0].slices;

    expect(slices[0]).toMatchObject({ revenue: 480_000, rate: 10, commission: 48_000, appliesToAll: true, empty: false });
    expect(slices[1]).toMatchObject({
      fromPct: 50,
      empty: true,
      acceleratorBand: true,
      emptyNote: "Accelerator band is empty",
      revenue: 0,
      commission: 0,
    });
  });

  it("pro-rates a single quarter and annualizes quota the same way as the benchmark", () => {
    let plan = makePlan({ period: "quarterly", mode: "single" });
    plan = {
      ...plan,
      ote: { baseSalary: 1_800_000, targetVariable: 600_000, employerOverheadPct: 0 },
    };
    plan = withData(plan, "new_arr", "q1", 300_000, 0);
    const explained = explain(plan);

    expect(explained.periods[0].label).toBe("Q1");
    expect(explained.periods[0].yearFractionLabel).toBe("1/4");
    expect(explained.periods[0].baseSalary).toBe(450_000);
    expect(explained.annualQuota).toBe(1_200_000);
    expect(explained.annualQuota).toBe(annualQuota(plan));
    expect(explained.annualTargetVariable).toBe(120_000);
    expect(explained.rateAtQuotaPct).toBe(10);
    expect(explained.rateAtQuotaPct).toBe(userPlanBenchmark(plan).rateAtQuotaPct);
  });

  it("sums a multi-period quota instead of multiplying it again", () => {
    let plan = makePlan({ period: "quarterly", mode: "multi" });
    plan = {
      ...plan,
      ote: { baseSalary: 1_200_000, targetVariable: 100_000, employerOverheadPct: 0 },
    };
    for (const id of ["q1", "q2", "q3", "q4"]) plan = withData(plan, "new_arr", id, 25_000, 0);
    const result = calculateCommission(plan);
    const explained = explainCalculation(plan, result);

    expect(explained.periods).toHaveLength(4);
    expect(explained.periods.map((period) => period.baseSalary)).toEqual([300_000, 300_000, 300_000, 300_000]);
    expect(explained.annualQuota).toBe(100_000);
    expect(explained.annualQuota).not.toBe(400_000);
    expect(explained.annualTargetVariable).toBe(10_000);
    expect(explained.rateAtQuotaPct).toBe(10);
    expect(explained.periods.reduce((sum, period) => sum + period.variableEarned, 0)).toBe(result.totals.earnedVariable);
  });

  it("leaves the rate blank when annual quota is missing", () => {
    const plan = makePlan();
    const explained = explain(plan);
    expect(explained.annualQuota).toBeNull();
    expect(explained.rateAtQuotaPct).toBeNull();
  });
});
