import { dec, max, round2, type Numeric } from "./money";

/** Top-up needed so that earned variable pay reaches the guaranteed amount. */
export function calculateGuarantee(earned: Numeric, guaranteedAmount: Numeric, eligible: boolean): number {
  if (!eligible) return 0;
  return round2(max(dec(guaranteedAmount).minus(dec(earned)), 0)).toNumber();
}
