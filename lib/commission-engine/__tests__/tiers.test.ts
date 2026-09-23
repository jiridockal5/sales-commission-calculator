import { describe, expect, it } from "vitest";
import { calculateMarginalTiers } from "../calculateMarginalTiers";
import { calculateRetroactiveTiers } from "../calculateRetroactiveTiers";
import { calculateCommission } from "../calculateCommission";
import { validateTiers } from "../tiers";
import { createTier } from "@/lib/plan/planFactory";
import { acceleratedPlan, makePlan, updateRule, withData } from "./helpers";

const twoTiers = () => [createTier(0, 100, 10), createTier(100, null, 15)];
const sixTiers = () => [
  createTier(0, 50, 0),
  createTier(50, 75, 5),
  createTier(75, 100, 10),
  createTier(100, 125, 15),
  createTier(125, 150, 20),
  createTier(150, null, 25),
];

describe("marginal tiers", () => {
  it("pays each band at its own rate (spec example)", () => {
    const r = calculateMarginalTiers(120_000, 100_000, twoTiers());
    expect(r.commission).toBe(13_000);
    expect(r.lines.map((l) => l.revenueInTier)).toEqual([100_000, 20_000]);
  });

  it("pays nothing above base at exactly 100%", () => {
    expect(calculateMarginalTiers(100_000, 100_000, twoTiers()).commission).toBe(10_000);
  });

  it("handles multiple accelerator tiers", () => {
    const r = calculateMarginalTiers(160_000, 100_000, sixTiers());
    // 0 + 25k*5% + 25k*10% + 25k*15% + 25k*20% + 10k*25%
    expect(r.commission).toBe(15_000);
    expect(r.lines.map((l) => l.commission)).toEqual([0, 1250, 2500, 3750, 5000, 2500]);
  });

  it("returns zero at 0% attainment", () => {
    expect(calculateMarginalTiers(0, 100_000, sixTiers()).commission).toBe(0);
  });
});

describe("retroactive tiers", () => {
  it("applies the reached rate to all revenue (spec example)", () => {
    expect(calculateRetroactiveTiers(120_000, 100_000, twoTiers()).commission).toBe(18_000);
  });

  it("applies the accelerator when the threshold is reached exactly", () => {
    expect(calculateRetroactiveTiers(100_000, 100_000, twoTiers()).commission).toBe(15_000);
    expect(calculateRetroactiveTiers(99_999, 100_000, twoTiers()).commission).toBe(9_999.9);
  });

  it("handles multiple tiers", () => {
    expect(calculateRetroactiveTiers(160_000, 100_000, sixTiers()).commission).toBe(40_000);
    expect(calculateRetroactiveTiers(40_000, 100_000, sixTiers()).commission).toBe(0);
  });
});

describe("tier method through the full engine", () => {
  it("marginal vs retroactive", () => {
    expect(calculateCommission(acceleratedPlan("marginal", 100_000, 120_000)).totals.commission).toBe(13_000);
    expect(calculateCommission(acceleratedPlan("retroactive", 100_000, 120_000)).totals.commission).toBe(18_000);
  });

  it("above quota and exactly at quota", () => {
    const at = calculateCommission(acceleratedPlan("marginal", 100_000, 100_000));
    expect(at.totals.commission).toBe(10_000);
    expect(at.totals.attainmentPct).toBe(100);
  });

  it("0% attainment pays nothing", () => {
    const r = calculateCommission(acceleratedPlan("marginal", 100_000, 0));
    expect(r.totals.commission).toBe(0);
    expect(r.totals.attainmentPct).toBe(0);
  });

  it("simple mode converts base rate + accelerator into tiers", () => {
    let plan = makePlan();
    plan = { ...plan, configMode: "simple", features: { ...plan.features, accelerators: true } };
    plan = updateRule(plan, "new_arr", { baseRate: 10, acceleratorFromPct: 100, acceleratorRate: 15 });
    plan = withData(plan, "new_arr", "fy", 100_000, 120_000);
    expect(calculateCommission(plan).totals.commission).toBe(13_000);

    const noAccel = { ...plan, features: { ...plan.features, accelerators: false } };
    expect(calculateCommission(noAccel).totals.commission).toBe(12_000);
  });

  it("falls back to the on-target rate when no quota is set", () => {
    const r = calculateCommission(acceleratedPlan("marginal", 0, 50_000));
    expect(r.totals.commission).toBe(5_000);
    expect(r.totals.attainmentPct).toBeNull();
  });
});

describe("tier validation", () => {
  it("accepts contiguous tiers", () => {
    expect(validateTiers(sixTiers())).toEqual([]);
  });

  it("flags gaps, bad bounds and unbounded middle tiers", () => {
    expect(validateTiers([createTier(0, 50, 5), createTier(60, null, 10)]).length).toBeGreaterThan(0);
    expect(validateTiers([createTier(0, null, 5), createTier(100, null, 10)]).length).toBeGreaterThan(0);
    expect(validateTiers([createTier(10, 5, 5)]).length).toBeGreaterThan(0);
    expect(validateTiers([])).toEqual(["Add at least one tier."]);
  });
});
