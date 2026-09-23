import { dec, max, pct, ratioPct, round2, type Numeric } from "./money";
import type { RampSchedule } from "./types";

/**
 * Ramp percentage for a period, given its position in the modeled range.
 * Tenure = firstPeriodNumber + position. Exact step matches win; gaps inherit the latest
 * earlier step; tenure beyond the last step is fully ramped (100%).
 */
export function getRampPct(ramp: RampSchedule, position: number): number {
  const tenure = Math.max(1, ramp.firstPeriodNumber) + position;
  const steps = [...ramp.steps].sort((a, b) => a.periodNumber - b.periodNumber);
  if (steps.length === 0) return 100;
  const last = steps[steps.length - 1];
  if (tenure > last.periodNumber) return 100;
  let current: number | null = null;
  for (const step of steps) {
    if (step.periodNumber <= tenure) current = step.pct;
  }
  return current ?? 100;
}

export function rampAdjustedQuota(fullQuota: Numeric, rampPct: Numeric): number {
  return round2(dec(fullQuota).mul(pct(rampPct))).toNumber();
}

/** Credited revenue = (actual - excluded) x weighting, floored at zero. */
export function creditedRevenue(actual: Numeric, excluded: Numeric, weightingPct: Numeric): number {
  const eligible = max(dec(actual).minus(dec(excluded)), 0);
  return round2(eligible.mul(pct(weightingPct))).toNumber();
}

/** Quota attainment in percent, or null when there is no quota. */
export function calculateQuotaAttainment(actual: Numeric, quota: Numeric): number | null {
  if (dec(quota).lte(0)) return null;
  return ratioPct(actual, quota);
}
