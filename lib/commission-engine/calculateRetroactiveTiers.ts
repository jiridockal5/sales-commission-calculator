import { dec, pct, round2, type Numeric } from "./money";
import type { TierCalculation } from "./calculateMarginalTiers";
import { sortTiers, tierAt, tierLabel } from "./tiers";
import type { CommissionTier } from "./types";

/** The rate of the highest tier reached applies to all revenue. */
export function calculateRetroactiveTiers(revenue: Numeric, quota: Numeric, tiers: CommissionTier[]): TierCalculation {
  const r = dec(revenue);
  const q = dec(quota);
  const attainment = q.gt(0) ? r.div(q).mul(100).toNumber() : 0;
  const applied = tierAt(tiers, attainment);
  const commission = applied ? round2(r.mul(pct(applied.rate))).toNumber() : 0;
  const lines = sortTiers(tiers).map((tier) => {
    const isApplied = applied?.id === tier.id;
    return {
      tierId: tier.id,
      label: tierLabel(tier),
      fromPct: tier.fromPct,
      toPct: tier.toPct,
      rate: tier.rate,
      revenueInTier: isApplied ? round2(r).toNumber() : 0,
      commission: isApplied ? commission : 0,
    };
  });
  return { lines, commission };
}
