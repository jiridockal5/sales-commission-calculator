import { deriveAnnualTargets } from "@/lib/commission-engine/calculateCommission";
import { activePeriods } from "@/lib/commission-engine/periods";
import { dec, money, ratioPct, type Numeric } from "@/lib/commission-engine/money";
import type { CommissionPlan, CurrencyCode, PeriodType } from "@/lib/commission-engine/types";

/**
 * SaaS AE survey medians from The Bridge Group AE Metrics v10.1 (2026).
 * Company survey medians, not compensation advice. Preview only — never written into a plan.
 *
 * Quota is OTE × 4.4 for every band. The rate row is the stated 11%, including the 70/30 band
 * (variable / quota is not reconciled to 11%).
 */
export const BENCHMARK_SOURCE =
  "The Bridge Group AE Metrics v10.1 (2026). Company survey medians, not compensation advice.";

export const QUOTA_TO_OTE = 4.4;
export const BENCHMARK_RATE_PCT = 11;
/**
 * Planning benchmark for actual revenue ÷ fully loaded employer cost.
 * Not a Bridge Group median. Payroll taxes and benefits belong in the cost.
 */
export const ACTUAL_TO_EMPLOYER_COST = 3;

export type AspBandId = "small" | "typical" | "large";

export interface AspBand {
  id: AspBandId;
  label: string;
  /** Deal-size band, stated in USD. */
  aspLabel: string;
  oteUsd: number;
  /** Base share of OTE, in percent. */
  basePct: number;
  /** Variable share of OTE, in percent. */
  variablePct: number;
}

export const ASP_BANDS: readonly AspBand[] = [
  { id: "small", label: "Small deals", aspLabel: "ASP under $5k", oteUsd: 120_000, basePct: 70, variablePct: 30 },
  { id: "typical", label: "Typical SaaS", aspLabel: "ASP $5k–$50k", oteUsd: 176_000, basePct: 50, variablePct: 50 },
  { id: "large", label: "Larger deals", aspLabel: "ASP $50k+", oteUsd: 210_000, basePct: 50, variablePct: 50 },
];

export const DEFAULT_ASP_BAND: AspBandId = "typical";

/** A single non-year period stands in for a year. Multiple periods are already a year and are only summed. */
const ANNUALIZATION: Record<PeriodType, number> = {
  monthly: 12,
  quarterly: 4,
  half_year: 2,
  annual: 1,
};

export interface PayMix {
  basePct: number;
  variablePct: number;
}

/** Survey medians. Money fields are null until the plan currency can be shown (USD always; others need a rate). */
export interface BenchmarkFigures {
  annualOte: number | null;
  payMix: PayMix;
  annualQuota: number | null;
  quotaToOte: number;
  rateAtQuotaPct: number;
}

/** Figures taken from the user's plan. Null means the row should stay empty. */
export interface UserPlanBenchmark {
  annualOte: number;
  /** Variable pay the rules produce at 100% of quota, annualized. */
  annualTargetVariable: number;
  payMix: PayMix | null;
  annualQuota: number | null;
  quotaToOte: number | null;
  rateAtQuotaPct: number | null;
}

export function aspBand(id: AspBandId): AspBand {
  return ASP_BANDS.find((band) => band.id === id) ?? ASP_BANDS[1];
}

/** Quota in USD for a band: OTE × 4.4, rounded to cents. */
export function benchmarkQuotaUsd(band: AspBand): number {
  return money(dec(band.oteUsd).mul(QUOTA_TO_OTE));
}

/**
 * Converts a USD benchmark amount into the plan currency.
 * USD is unchanged. Other currencies stay hidden (null) until `unitsPerUsd` is a positive rate.
 * Ratios are not passed through this function.
 */
export function convertBenchmarkAmount(amountUsd: number, currency: CurrencyCode, unitsPerUsd: number | null): number | null {
  if (currency === "USD") return money(amountUsd);
  if (unitsPerUsd === null || !Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) return null;
  return money(dec(amountUsd).mul(unitsPerUsd));
}

/**
 * (user − benchmark) / benchmark × 100.
 * Null when either side is missing or the benchmark is 0.
 */
export function relativeGapPct(user: number | null, benchmark: number | null): number | null {
  if (user === null || benchmark === null || !Number.isFinite(user) || !Number.isFinite(benchmark)) return null;
  const denominator = dec(benchmark);
  if (denominator.isZero()) return null;
  return dec(user).minus(benchmark).div(denominator).mul(100).toDecimalPlaces(4).toNumber();
}

/** user − benchmark, in percentage points. Null when either side is missing. */
export function pointGap(user: number | null, benchmark: number | null): number | null {
  if (user === null || benchmark === null || !Number.isFinite(user) || !Number.isFinite(benchmark)) return null;
  return dec(user).minus(benchmark).toDecimalPlaces(4).toNumber();
}

export function benchmarkFigures(bandId: AspBandId, currency: CurrencyCode, unitsPerUsd: number | null): BenchmarkFigures {
  const band = aspBand(bandId);
  const quotaUsd = benchmarkQuotaUsd(band);
  return {
    annualOte: convertBenchmarkAmount(band.oteUsd, currency, unitsPerUsd),
    payMix: { basePct: band.basePct, variablePct: band.variablePct },
    annualQuota: convertBenchmarkAmount(quotaUsd, currency, unitsPerUsd),
    quotaToOte: QUOTA_TO_OTE,
    rateAtQuotaPct: BENCHMARK_RATE_PCT,
  };
}

function ratio(a: Numeric, b: Numeric): number | null {
  const denominator = dec(b);
  if (denominator.lte(0)) return null;
  return dec(a).div(denominator).toDecimalPlaces(4).toNumber();
}

/**
 * Annual quota for quota-based revenue types (individual scope only).
 * Single-period plans are annualized (month × 12, quarter × 4, half-year × 2, year × 1).
 * Multi-period plans sum every active period and are not multiplied again.
 * Returns null when there is no positive quota.
 */
export function annualQuota(plan: CommissionPlan): number | null {
  const periods = activePeriods(plan);
  if (periods.length === 0) return null;
  const quotaTypes = plan.revenueTypes.filter((type) => type.enabled && type.quotaBased);
  const raw = periods.reduce((total, period) => {
    const periodTotal = quotaTypes.reduce((sum, type) => {
      const amount =
        plan.quotas.find((q) => q.periodId === period.id && q.revenueTypeId === type.id && q.scope === "individual")?.amount ?? 0;
      return sum.plus(dec(amount));
    }, dec(0));
    return total.plus(periodTotal);
  }, dec(0));
  if (raw.lte(0)) return null;
  const annual = plan.mode === "single" ? raw.mul(ANNUALIZATION[periods[0].periodType]) : raw;
  return money(annual);
}

/** Actual ÷ total employer cost. Null when the cost is missing or not positive. */
export function actualToEmployerCost(actual: Numeric, employerCost: Numeric): number | null {
  return ratio(actual, employerCost);
}

/** User-plan side of the benchmark rows. Derives on-target variable from the rules and does not mutate the plan. */
export function userPlanBenchmark(plan: CommissionPlan): UserPlanBenchmark {
  const annualTargetVariable = deriveAnnualTargets(plan).annualTargetVariable;
  const annualOte = money(dec(plan.ote.baseSalary).plus(annualTargetVariable));
  const quota = annualQuota(plan);
  return {
    annualOte,
    annualTargetVariable,
    payMix:
      annualOte === 0
        ? null
        : {
            basePct: ratioPct(plan.ote.baseSalary, annualOte) ?? 0,
            variablePct: ratioPct(annualTargetVariable, annualOte) ?? 0,
          },
    annualQuota: quota,
    quotaToOte: quota === null ? null : ratio(quota, annualOte),
    rateAtQuotaPct: quota === null ? null : ratioPct(annualTargetVariable, quota),
  };
}
