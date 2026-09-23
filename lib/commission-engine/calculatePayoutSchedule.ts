import { sumMoney } from "./money";
import { MONTHS_PER_PERIOD, periodLabel } from "./periods";
import type { PayoutGroup, Period, PeriodType } from "./types";

/**
 * Groups per-period payouts into payout dates. Calculation happens per period; payment
 * happens at the (equal or less frequent) payout frequency.
 */
export function calculatePayoutSchedule(
  periods: Period[],
  payouts: number[],
  payoutFrequency: PeriodType,
): PayoutGroup[] {
  const groups = new Map<number, PayoutGroup & { amounts: number[] }>();
  periods.forEach((period, i) => {
    const payoutMonths = Math.max(MONTHS_PER_PERIOD[payoutFrequency], period.months);
    const frequency = (Object.keys(MONTHS_PER_PERIOD) as PeriodType[]).find(
      (t) => MONTHS_PER_PERIOD[t] === payoutMonths,
    )!;
    const bucket = Math.floor(period.startMonth / payoutMonths);
    const group = groups.get(bucket) ?? { label: periodLabel(frequency, bucket), periodIds: [], payout: 0, amounts: [] };
    group.periodIds.push(period.id);
    group.amounts.push(payouts[i] ?? 0);
    groups.set(bucket, group);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, g]) => ({ label: g.label, periodIds: g.periodIds, payout: sumMoney(g.amounts) }));
}
