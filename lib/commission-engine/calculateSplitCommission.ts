import { dec, pct, round2, sum, type Numeric } from "./money";
import type { SplitResult, SplitRule } from "./types";

export function validateSplits(splits: SplitRule[]): string[] {
  const errors: string[] = [];
  if (splits.length === 0) return ["Add at least one role."];
  if (splits.some((s) => s.pct < 0)) errors.push("Split percentages cannot be negative.");
  const total = sum(splits.map((s) => s.pct));
  if (!total.eq(100)) errors.push(`Splits must total 100% (currently ${total.toString()}%).`);
  return errors;
}

/**
 * Splits a commission pool between roles. Any rounding remainder (from cents) is
 * assigned to the largest share so lines always add up to the pool.
 */
export function calculateSplitCommission(pool: Numeric, splits: SplitRule[]): SplitResult {
  const total = sum(splits.map((s) => s.pct));
  const valid = validateSplits(splits).length === 0;
  const poolDec = round2(pool);
  const lines = splits.map((s) => ({
    splitRuleId: s.id,
    role: s.role,
    pct: s.pct,
    amount: round2(poolDec.mul(pct(s.pct))).toNumber(),
  }));
  if (valid && lines.length > 0) {
    const remainder = poolDec.minus(sum(lines.map((l) => l.amount)));
    if (!remainder.isZero()) {
      const largest = lines.reduce((a, b) => (b.pct > a.pct ? b : a));
      largest.amount = dec(largest.amount).plus(remainder).toNumber();
    }
  }
  return { valid, totalPct: total.toNumber(), pool: poolDec.toNumber(), lines };
}
