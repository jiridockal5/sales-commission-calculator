import { clamp, dec, max, pct, round2, sumMoney, type Numeric } from "./money";
import { sortTiers, tierLabel } from "./tiers";
import type { CommissionTier, TierBreakdownLine } from "./types";

export interface TierCalculation {
  lines: TierBreakdownLine[];
  commission: number;
}

/** Each band of revenue earns only its own tier's rate. */
export function calculateMarginalTiers(revenue: Numeric, quota: Numeric, tiers: CommissionTier[]): TierCalculation {
  const r = dec(revenue);
  const q = dec(quota);
  const lines = sortTiers(tiers).map((tier) => {
    const low = q.mul(pct(tier.fromPct));
    const inTier =
      tier.toPct === null
        ? max(r.minus(low), 0)
        : clamp(r.minus(low), 0, q.mul(pct(tier.toPct)).minus(low));
    return {
      tierId: tier.id,
      label: tierLabel(tier),
      fromPct: tier.fromPct,
      toPct: tier.toPct,
      rate: tier.rate,
      revenueInTier: round2(inTier).toNumber(),
      commission: round2(inTier.mul(pct(tier.rate))).toNumber(),
    };
  });
  return { lines, commission: sumMoney(lines.map((l) => l.commission)) };
}
