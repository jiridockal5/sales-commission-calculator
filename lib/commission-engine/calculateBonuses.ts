import type { BonusResult, BonusRule } from "./types";

/**
 * Milestone bonuses stack: every milestone whose attainment is reached (inclusive) pays
 * its amount. With no attainment (no quota) no bonus is earned.
 */
export function calculateBonuses(attainmentPct: number | null, rules: BonusRule[]): BonusResult[] {
  if (attainmentPct === null) return [];
  return [...rules]
    .sort((a, b) => a.attainmentPct - b.attainmentPct)
    .filter((rule) => rule.amount > 0 && attainmentPct >= rule.attainmentPct)
    .map((rule) => ({ bonusRuleId: rule.id, attainmentPct: rule.attainmentPct, amount: rule.amount }));
}
