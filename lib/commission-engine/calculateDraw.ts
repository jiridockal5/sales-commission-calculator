import { dec, max, min, round2, type Dec, type Numeric } from "./money";
import type { DrawLedgerEntry, DrawRule } from "./types";

export interface DrawCalculation {
  entries: DrawLedgerEntry[];
  payouts: number[];
  endingBalance: number;
}

/**
 * Runs the draw ledger across periods.
 *
 * - Earned >= draw: rep receives earnings less recovery of any outstanding balance,
 *   never dropping below the draw.
 * - Earned < draw: rep receives the draw. A recoverable draw adds the shortfall to the
 *   balance; a non-recoverable draw forgives it.
 * - Negative earnings (clawbacks exceeding commission) always carry forward as a balance.
 *
 * Without a draw rule the same ledger runs with a draw of zero, which carries negative
 * periods forward instead of producing negative payouts.
 */
export function calculateDraw(netEarned: Numeric[], rule: DrawRule | null): DrawCalculation {
  const draw = rule ? max(dec(rule.amountPerPeriod), 0) : dec(0);
  const recoverable = !rule || rule.type === "recoverable";
  let balance: Dec = dec(0);
  const entries: DrawLedgerEntry[] = [];
  const payouts: number[] = [];

  for (const value of netEarned) {
    const earned = round2(value);
    const balanceBefore = balance;
    let payout: Dec;
    let advance = dec(0);
    let recovery = dec(0);
    let forgiven = dec(0);

    if (earned.gte(draw)) {
      recovery = min(balance, earned.minus(draw));
      balance = balance.minus(recovery);
      payout = earned.minus(recovery);
    } else {
      payout = draw;
      const coveredByEarnings = max(earned, 0);
      advance = draw.minus(coveredByEarnings);
      const negativeCarry = max(earned.neg(), 0);
      if (recoverable) {
        balance = balance.plus(draw.minus(earned));
      } else {
        forgiven = advance;
        balance = balance.plus(negativeCarry);
      }
    }

    entries.push({
      drawAmount: round2(draw).toNumber(),
      advance: round2(advance).toNumber(),
      recovery: round2(recovery).toNumber(),
      forgiven: round2(forgiven).toNumber(),
      balanceBefore: round2(balanceBefore).toNumber(),
      balanceAfter: round2(balance).toNumber(),
    });
    payouts.push(round2(payout).toNumber());
  }

  return { entries, payouts, endingBalance: round2(balance).toNumber() };
}
