import type { CommissionRule, CommissionTier, ConfigMode } from "./types";

export function tierLabel(tier: Pick<CommissionTier, "fromPct" | "toPct">): string {
  return tier.toPct === null ? `${tier.fromPct}%+` : `${tier.fromPct}–${tier.toPct}%`;
}

export function sortTiers(tiers: CommissionTier[]): CommissionTier[] {
  return [...tiers].sort((a, b) => a.fromPct - b.fromPct);
}

/**
 * Resolves the effective tier table for a rule. Simple mode is expressed as tiers so that
 * both modes share one calculation path.
 */
export function resolveTiers(rule: CommissionRule, configMode: ConfigMode, acceleratorsEnabled: boolean): CommissionTier[] {
  if (configMode === "advanced") return sortTiers(rule.tiers);
  if (acceleratorsEnabled && rule.acceleratorFromPct > 0) {
    return [
      { id: `${rule.id}-base`, fromPct: 0, toPct: rule.acceleratorFromPct, rate: rule.baseRate },
      { id: `${rule.id}-accel`, fromPct: rule.acceleratorFromPct, toPct: null, rate: rule.acceleratorRate },
    ];
  }
  return [{ id: `${rule.id}-base`, fromPct: 0, toPct: null, rate: rule.baseRate }];
}

/** The tier that contains a given attainment (last tier whose lower bound is reached). */
export function tierAt(tiers: CommissionTier[], attainmentPct: number): CommissionTier | null {
  let found: CommissionTier | null = null;
  for (const tier of sortTiers(tiers)) {
    if (attainmentPct >= tier.fromPct) found = tier;
  }
  if (found && found.toPct !== null && attainmentPct >= found.toPct) return null;
  return found;
}

/** The tier paying on-target revenue: the one covering attainment up to 100%. */
export function onTargetTier(tiers: CommissionTier[]): CommissionTier | null {
  const sorted = sortTiers(tiers);
  return sorted.find((t) => t.fromPct < 100 && (t.toPct === null || t.toPct >= 100)) ?? sorted[0] ?? null;
}

/**
 * Updates one bound without reordering rows. Neighbor linking is optional so the editor
 * can apply it only when the user leaves the field, not on each keystroke.
 */
export function updateTierBound(
  tiers: CommissionTier[],
  index: number,
  field: "fromPct" | "toPct",
  value: number,
  linkNeighbor = false,
): CommissionTier[] {
  if (index < 0 || index >= tiers.length) return tiers;
  const next = tiers.map((t) => ({ ...t }));
  if (field === "toPct") {
    next[index] = { ...next[index], toPct: value };
    if (linkNeighbor && next[index + 1]) next[index + 1] = { ...next[index + 1], fromPct: value };
  } else {
    next[index] = { ...next[index], fromPct: value };
    if (linkNeighbor && index > 0) next[index - 1] = { ...next[index - 1], toPct: value };
  }
  return next;
}

export function validateTiers(tiers: CommissionTier[], options?: { preserveOrder?: boolean }): string[] {
  const errors: string[] = [];
  if (tiers.length === 0) {
    errors.push("Add at least one tier.");
    return errors;
  }
  const sorted = options?.preserveOrder ? tiers : sortTiers(tiers);
  if (sorted[0].fromPct !== 0) errors.push("The first tier should start at 0%.");
  sorted.forEach((tier, i) => {
    if (tier.fromPct < 0) errors.push(`Tier ${i + 1}: start cannot be negative.`);
    if (tier.rate < 0) errors.push(`Tier ${i + 1}: rate cannot be negative.`);
    if (tier.toPct !== null && tier.toPct <= tier.fromPct) errors.push(`Tier ${i + 1}: end must be greater than start.`);
    const next = sorted[i + 1];
    if (next) {
      if (tier.toPct === null) errors.push(`Tier ${i + 1}: only the last tier can be unbounded.`);
      else if (tier.toPct !== next.fromPct) errors.push(`Tier ${i + 1} ends at ${tier.toPct}% but tier ${i + 2} starts at ${next.fromPct}%.`);
    }
  });
  return errors;
}
