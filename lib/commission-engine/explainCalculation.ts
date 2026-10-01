import { userPlanBenchmark } from "@/lib/benchmarks/saasAeBenchmark";
import { dec, money } from "./money";
import { PERIOD_TYPE_LABELS, yearFraction } from "./periods";
import type {
  CalculationResult,
  CommissionPlan,
  PeriodResult,
  PeriodType,
  RevenueTypeResult,
  TierBreakdownLine,
} from "./types";

const YEAR_FRACTION_LABEL: Record<PeriodType, string> = {
  monthly: "1/12",
  quarterly: "1/4",
  half_year: "1/2",
  annual: "1",
};

export interface CommissionSliceExplanation {
  tierId: string;
  label: string;
  fromPct: number;
  toPct: number | null;
  rate: number;
  revenue: number;
  commission: number;
  /** True when this band contains none of the revenue used for commission. */
  empty: boolean;
  /**
   * Simple mode only: this empty band is the accelerator (revenue is still below
   * `acceleratorFromPct`, so that rate adds nothing).
   */
  acceleratorBand: boolean;
  /** Retroactive: this rate applies to all credited revenue, not a marginal slice. */
  appliesToAll: boolean;
  /** Set for an empty band. "Accelerator band is empty" when `acceleratorBand` is set. */
  emptyNote: "Accelerator band is empty" | "Band is empty" | null;
}

export interface RevenueTypeExplanation {
  revenueTypeId: string;
  label: string;
  method: RevenueTypeResult["method"];
  quotaBased: boolean;
  quota: number;
  actual: number;
  credited: number;
  /** Revenue the tiers actually ran on (after a max-attainment cap, when one applies). */
  commissionable: number;
  attainmentPct: number | null;
  belowThreshold: boolean;
  /** Threshold percent when that feature is on and the rule's threshold is above 0. */
  thresholdPct: number | null;
  grossCommission: number;
  capReduction: number;
  commission: number;
  slices: CommissionSliceExplanation[];
}

export interface PeriodExplanation {
  periodId: string;
  label: string;
  periodType: PeriodType;
  periodTypeLabel: string;
  /** "1", "1/2", "1/4", or "1/12" — the share of the year this period's base uses. */
  yearFractionLabel: string;
  yearFraction: number;
  baseSalary: number;
  quota: number;
  actual: number;
  attainmentPct: number | null;
  commission: number;
  bonusTotal: number;
  guaranteeTopUp: number;
  clawback: number;
  teamCommission: number;
  planCapReduction: number;
  /** Net variable for the period. Same basis as the Variable earned total. */
  variableEarned: number;
  /** Period base + variable earned. */
  totalCash: number;
  revenueTypes: RevenueTypeExplanation[];
}

export interface CalculationExplanation {
  annualBase: number;
  annualTargetVariable: number;
  annualOte: number;
  /** Same annual-quota rule as the SaaS benchmark. Null when no positive quota is set. */
  annualQuota: number | null;
  /** Annual target variable / annual quota, in percent. Null when annual quota is missing. */
  rateAtQuotaPct: number | null;
  periods: PeriodExplanation[];
}

function isEmptyLine(line: TierBreakdownLine): boolean {
  return line.revenueInTier === 0 && line.commission === 0;
}

function thresholdPercent(plan: CommissionPlan, revenueTypeId: string): number | null {
  if (!plan.features.threshold) return null;
  const rule = plan.rules.find((r) => r.revenueTypeId === revenueTypeId);
  if (!rule || rule.thresholdPct <= 0) return null;
  return rule.thresholdPct;
}

function toSlice(
  plan: CommissionPlan,
  typeResult: RevenueTypeResult,
  line: TierBreakdownLine,
): CommissionSliceExplanation {
  const empty = isEmptyLine(line);
  const rule = plan.rules.find((r) => r.revenueTypeId === typeResult.revenueTypeId);
  const acceleratorBand =
    empty &&
    typeResult.method !== "flat" &&
    plan.configMode === "simple" &&
    plan.features.accelerators &&
    rule !== undefined &&
    line.fromPct === rule.acceleratorFromPct;
  return {
    tierId: line.tierId,
    label: line.label,
    fromPct: line.fromPct,
    toPct: line.toPct,
    rate: line.rate,
    revenue: line.revenueInTier,
    commission: line.commission,
    empty,
    acceleratorBand,
    appliesToAll: typeResult.method === "retroactive" && !empty,
    emptyNote: empty ? (acceleratorBand ? "Accelerator band is empty" : "Band is empty") : null,
  };
}

/**
 * Bands worth showing. Filled bands stay. Empty bands above the revenue are kept
 * so an accelerator that was not reached is visible. Lower retroactive bands
 * (the rate that was replaced) are left out.
 */
function explainSlices(plan: CommissionPlan, typeResult: RevenueTypeResult): CommissionSliceExplanation[] {
  if (typeResult.belowThreshold) return [];
  const lines = typeResult.tierLines;
  if (lines.length === 0) return [];

  if (typeResult.method === "retroactive") {
    const appliedFrom = lines.reduce((max, line) => (!isEmptyLine(line) ? Math.max(max, line.fromPct) : max), -1);
    const chosen =
      appliedFrom < 0 ? lines.slice(0, 1) : lines.filter((line) => !isEmptyLine(line) || line.fromPct > appliedFrom);
    return chosen.map((line) => toSlice(plan, typeResult, line));
  }

  let lastFilled = -1;
  lines.forEach((line, index) => {
    if (!isEmptyLine(line)) lastFilled = index;
  });

  // No revenue in any band: show the first band and the next one (the accelerator, in simple mode).
  if (lastFilled === -1) {
    return lines.slice(0, 2).map((line) => toSlice(plan, typeResult, line));
  }

  // Filled bands, then every empty band above them so an unreached accelerator stays visible.
  return lines.filter((line, index) => index <= lastFilled || isEmptyLine(line)).map((line) => toSlice(plan, typeResult, line));
}

function explainRevenueType(plan: CommissionPlan, typeResult: RevenueTypeResult): RevenueTypeExplanation {
  return {
    revenueTypeId: typeResult.revenueTypeId,
    label: typeResult.label,
    method: typeResult.method,
    quotaBased: typeResult.quotaBased,
    quota: typeResult.quota,
    actual: typeResult.actual,
    credited: typeResult.credited,
    commissionable: typeResult.commissionable,
    attainmentPct: typeResult.attainmentPct,
    belowThreshold: typeResult.belowThreshold,
    thresholdPct: thresholdPercent(plan, typeResult.revenueTypeId),
    grossCommission: typeResult.grossCommission,
    capReduction: typeResult.capReduction,
    commission: typeResult.commission,
    slices: explainSlices(plan, typeResult),
  };
}

function explainPeriod(plan: CommissionPlan, period: PeriodResult): PeriodExplanation {
  const periodType = plan.calculationPeriod;
  return {
    periodId: period.periodId,
    label: period.label,
    periodType,
    periodTypeLabel: PERIOD_TYPE_LABELS[periodType],
    yearFractionLabel: YEAR_FRACTION_LABEL[periodType],
    yearFraction: yearFraction(periodType),
    baseSalary: period.baseSalary,
    quota: period.quota,
    actual: period.actual,
    attainmentPct: period.attainmentPct,
    commission: period.commission,
    bonusTotal: period.bonusTotal,
    guaranteeTopUp: period.guaranteeTopUp,
    clawback: period.clawback,
    teamCommission: period.teamCommission,
    planCapReduction: period.planCapReduction,
    variableEarned: period.netEarned,
    totalCash: money(dec(period.baseSalary).plus(period.netEarned)),
    revenueTypes: period.revenueTypes.map((typeResult) => explainRevenueType(plan, typeResult)),
  };
}

/**
 * Turns a plan and an engine result into the lines shown on Compensation.
 * Reads tier slices from the result; it does not recompute commission or change the plan.
 * Annual target variable, annual quota, and the rate at 100% of quota come from the benchmark helper.
 */
export function explainCalculation(plan: CommissionPlan, result: CalculationResult): CalculationExplanation {
  const figures = userPlanBenchmark(plan);
  return {
    annualBase: money(plan.ote.baseSalary),
    annualTargetVariable: figures.annualTargetVariable,
    annualOte: figures.annualOte,
    annualQuota: figures.annualQuota,
    rateAtQuotaPct: figures.rateAtQuotaPct,
    periods: result.periods.map((period) => explainPeriod(plan, period)),
  };
}
