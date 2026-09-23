import type { CommissionPlan, Period, PeriodType } from "./types";

export const MONTHS_PER_PERIOD: Record<PeriodType, number> = {
  monthly: 1,
  quarterly: 3,
  half_year: 6,
  annual: 12,
};

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_year: "Half-year",
  annual: "Annual",
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodCount(type: PeriodType): number {
  return 12 / MONTHS_PER_PERIOD[type];
}

export function periodLabel(type: PeriodType, index: number): string {
  switch (type) {
    case "monthly":
      return MONTH_LABELS[index] ?? `M${index + 1}`;
    case "quarterly":
      return `Q${index + 1}`;
    case "half_year":
      return `H${index + 1}`;
    case "annual":
      return "FY";
  }
}

/** Deterministic period id so quota/performance rows survive single/multi switches. */
export function periodId(type: PeriodType, index: number): string {
  const prefix = { monthly: "m", quarterly: "q", half_year: "h", annual: "fy" }[type];
  return type === "annual" ? prefix : `${prefix}${index + 1}`;
}

export function generatePeriods(planId: string, type: PeriodType): Period[] {
  const months = MONTHS_PER_PERIOD[type];
  return Array.from({ length: periodCount(type) }, (_, index) => ({
    id: periodId(type, index),
    planId,
    periodType: type,
    index,
    label: periodLabel(type, index),
    startMonth: index * months,
    months,
  }));
}

/** Periods included in the calculation, in chronological order. */
export function activePeriods(plan: CommissionPlan): Period[] {
  const sorted = [...plan.periods].sort((a, b) => a.index - b.index);
  if (plan.mode === "multi") return sorted;
  const single = sorted.find((p) => p.index === plan.singlePeriodIndex) ?? sorted[0];
  return single ? [single] : [];
}

/** Payout frequencies that are not more frequent than the calculation period. */
export function allowedPayoutFrequencies(calculationPeriod: PeriodType): PeriodType[] {
  const months = MONTHS_PER_PERIOD[calculationPeriod];
  return (Object.keys(MONTHS_PER_PERIOD) as PeriodType[]).filter((t) => MONTHS_PER_PERIOD[t] >= months);
}

/** Fraction of a year covered by a period type, e.g. quarterly = 1/4. */
export function yearFraction(type: PeriodType): number {
  return MONTHS_PER_PERIOD[type] / 12;
}
