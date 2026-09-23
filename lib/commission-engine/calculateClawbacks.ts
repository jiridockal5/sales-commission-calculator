import { dec, pct, round2, sumMoney } from "./money";
import type { ClawbackEntry, ClawbackRule } from "./types";

/** Clawback for a single aggregated entry: original commission x rule percentage (100% without a rule). */
export function clawbackAmount(entry: ClawbackEntry, rules: ClawbackRule[]): number {
  const rule = entry.clawbackRuleId ? rules.find((r) => r.id === entry.clawbackRuleId) : undefined;
  const rate = rule ? pct(rule.pct) : dec(1);
  return round2(dec(Math.max(0, entry.commissionAmount)).mul(rate)).toNumber();
}

export function calculateClawbacks(periodId: string, entries: ClawbackEntry[], rules: ClawbackRule[]): number {
  return sumMoney(entries.filter((e) => e.periodId === periodId).map((e) => clawbackAmount(e, rules)));
}
