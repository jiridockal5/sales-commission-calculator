import { describe, expect, it } from "vitest";
import { withData, makePlan } from "@/lib/commission-engine/__tests__/helpers";
import { money, dec } from "@/lib/commission-engine/money";
import {
  BENCHMARK_RATE_PCT,
  QUOTA_TO_OTE,
  annualQuota,
  benchmarkFigures,
  benchmarkQuotaUsd,
  convertBenchmarkAmount,
  userPlanBenchmark,
  aspBand,
} from "./saasAeBenchmark";

describe("SaaS AE benchmark bands", () => {
  it("sets every band's quota to OTE × 4.4 and keeps the rate row at 11%", () => {
    expect(QUOTA_TO_OTE).toBe(4.4);
    expect(benchmarkQuotaUsd(aspBand("small"))).toBe(money(dec(120_000).mul(QUOTA_TO_OTE)));
    expect(benchmarkQuotaUsd(aspBand("typical"))).toBe(money(dec(176_000).mul(QUOTA_TO_OTE)));
    expect(benchmarkQuotaUsd(aspBand("large"))).toBe(money(dec(210_000).mul(QUOTA_TO_OTE)));
    expect(benchmarkQuotaUsd(aspBand("small"))).toBe(528_000);
    expect(benchmarkQuotaUsd(aspBand("typical"))).toBe(774_400);
    expect(benchmarkQuotaUsd(aspBand("large"))).toBe(924_000);

    for (const id of ["small", "typical", "large"] as const) {
      const figures = benchmarkFigures(id, "USD", null);
      expect(figures.quotaToOte).toBe(4.4);
      expect(figures.rateAtQuotaPct).toBe(BENCHMARK_RATE_PCT);
      expect(figures.rateAtQuotaPct).toBe(11);
      expect(figures.annualOte).toBe(aspBand(id).oteUsd);
      expect(figures.annualQuota).toBe(benchmarkQuotaUsd(aspBand(id)));
    }
  });

  it("shows 11% for the 70/30 band instead of variable divided by quota", () => {
    const small = benchmarkFigures("small", "USD", null);
    expect(small.payMix).toEqual({ basePct: 70, variablePct: 30 });
    const reconciled = ((120_000 * 0.3) / 528_000) * 100;
    expect(reconciled).toBeCloseTo(6.8182, 3);
    expect(small.rateAtQuotaPct).toBe(11);
    expect(small.rateAtQuotaPct).not.toBeCloseTo(reconciled, 1);
  });
});

describe("annual quota from the plan", () => {
  it("annualizes a single month, quarter, or half-year and leaves a single year unchanged", () => {
    const month = withData(makePlan({ period: "monthly", mode: "single" }), "new_arr", "m1", 10_000, 0);
    const quarter = withData(makePlan({ period: "quarterly", mode: "single" }), "new_arr", "q1", 10_000, 0);
    const half = withData(makePlan({ period: "half_year", mode: "single" }), "new_arr", "h1", 10_000, 0);
    const year = withData(makePlan({ period: "annual", mode: "single" }), "new_arr", "fy", 10_000, 0);
    expect(annualQuota(month)).toBe(120_000);
    expect(annualQuota(quarter)).toBe(40_000);
    expect(annualQuota(half)).toBe(20_000);
    expect(annualQuota(year)).toBe(10_000);
  });

  it("sums four quarters and does not multiply the sum", () => {
    let plan = makePlan({ period: "quarterly", mode: "multi" });
    for (const id of ["q1", "q2", "q3", "q4"]) plan = withData(plan, "new_arr", id, 25_000, 0);
    expect(annualQuota(plan)).toBe(100_000);
    expect(annualQuota(plan)).not.toBe(400_000);
  });

  it("annualizes only the selected period when the plan is single-period", () => {
    let plan = makePlan({ period: "quarterly", mode: "single" });
    plan = withData(plan, "new_arr", "q1", 10_000, 0);
    plan = withData(plan, "new_arr", "q2", 80_000, 0);
    expect(annualQuota(plan)).toBe(40_000);
  });

  it("sums quota-based revenue types and ignores flat-rate and team quotas", () => {
    let plan = makePlan({ period: "annual", mode: "single", enabled: ["new_arr", "expansion", "renewal"] });
    plan = withData(plan, "new_arr", "fy", 100_000, 0);
    plan = withData(plan, "expansion", "fy", 40_000, 0);
    plan = withData(plan, "renewal", "fy", 999_000, 0);
    plan = withData(plan, "new_arr", "fy", 50_000, 0, "team");
    expect(annualQuota(plan)).toBe(140_000);
  });

  it("leaves quota, quota/OTE, and rate empty when quota is 0", () => {
    const plan = makePlan({ period: "annual", mode: "single" });
    plan.ote = { baseSalary: 80_000, targetVariable: 40_000, employerOverheadPct: 0 };
    const side = userPlanBenchmark(plan);
    expect(side.annualOte).toBe(120_000);
    expect(side.annualQuota).toBeNull();
    expect(side.quotaToOte).toBeNull();
    expect(side.rateAtQuotaPct).toBeNull();
    expect(side.payMix).toEqual({ basePct: 66.6667, variablePct: 33.3333 });
  });

  it("uses annual target variable divided by annual quota, not a tier rate, and does not scale OTE by period count", () => {
    let plan = makePlan({ period: "quarterly", mode: "single" });
    plan = { ...plan, ote: { baseSalary: 12_000, targetVariable: 8_000, employerOverheadPct: 0 } };
    plan = withData(plan, "new_arr", "q1", 10_000, 0);
    const before = structuredClone(plan);
    const side = userPlanBenchmark(plan);
    expect(plan).toEqual(before);
    expect(side.annualOte).toBe(20_000);
    expect(side.annualQuota).toBe(40_000);
    expect(side.quotaToOte).toBe(2);
    expect(side.rateAtQuotaPct).toBe(20);
    expect(side.payMix).toEqual({ basePct: 60, variablePct: 40 });
  });

  it("leaves pay mix empty when OTE is 0", () => {
    const plan = withData(makePlan({ period: "annual" }), "new_arr", "fy", 50_000, 0);
    const side = userPlanBenchmark(plan);
    expect(side.annualOte).toBe(0);
    expect(side.payMix).toBeNull();
    expect(side.quotaToOte).toBeNull();
    expect(side.rateAtQuotaPct).toBe(0);
  });
});

describe("benchmark currency conversion", () => {
  it("converts OTE and quota only, and leaves ratios unchanged when the rate is empty", () => {
    const hidden = benchmarkFigures("typical", "EUR", null);
    expect(hidden.annualOte).toBeNull();
    expect(hidden.annualQuota).toBeNull();
    expect(hidden.payMix).toEqual({ basePct: 50, variablePct: 50 });
    expect(hidden.quotaToOte).toBe(4.4);
    expect(hidden.rateAtQuotaPct).toBe(11);

    const shown = benchmarkFigures("typical", "CZK", 23.5);
    expect(shown.annualOte).toBe(176_000 * 23.5);
    expect(shown.annualQuota).toBe(774_400 * 23.5);
    expect(shown.payMix).toEqual(hidden.payMix);
    expect(shown.quotaToOte).toBe(hidden.quotaToOte);
    expect(shown.rateAtQuotaPct).toBe(hidden.rateAtQuotaPct);

    expect(benchmarkFigures("typical", "USD", 23.5).annualOte).toBe(176_000);
    expect(benchmarkFigures("typical", "USD", null).annualQuota).toBe(774_400);
    expect(convertBenchmarkAmount(176_000, "GBP", 0)).toBeNull();
    expect(convertBenchmarkAmount(176_000, "GBP", -1)).toBeNull();
  });

  it("rounds converted amounts to cents, half up", () => {
    expect(convertBenchmarkAmount(10.005, "EUR", 1)).toBe(10.01);
    expect(money(dec(176_000).mul("0.1"))).toBe(17_600);
    expect(benchmarkFigures("typical", "EUR", 0.1).annualOte).toBe(17_600);
  });
});
