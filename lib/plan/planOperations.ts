import { allowedPayoutFrequencies, generatePeriods, periodCount } from "@/lib/commission-engine/periods";
import type {
  CommissionPlan,
  CommissionRule,
  FeatureToggles,
  PeriodType,
  RevenueType,
} from "@/lib/commission-engine/types";

/** Changes the calculation period, regenerating periods and keeping payout frequency valid. */
export function changeCalculationPeriod(plan: CommissionPlan, type: PeriodType): CommissionPlan {
  const allowed = allowedPayoutFrequencies(type);
  return {
    ...plan,
    calculationPeriod: type,
    periods: generatePeriods(plan.id, type),
    singlePeriodIndex: Math.min(plan.singlePeriodIndex, periodCount(type) - 1),
    payoutFrequency: allowed.includes(plan.payoutFrequency) ? plan.payoutFrequency : type,
  };
}

export function updateRule(plan: CommissionPlan, ruleId: string, patch: Partial<CommissionRule>): CommissionPlan {
  return { ...plan, rules: plan.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) };
}

export function updateRevenueType(plan: CommissionPlan, id: string, patch: Partial<RevenueType>): CommissionPlan {
  return { ...plan, revenueTypes: plan.revenueTypes.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function setFeature(plan: CommissionPlan, key: keyof FeatureToggles, value: boolean): CommissionPlan {
  return { ...plan, features: { ...plan.features, [key]: value } };
}

export function enabledRevenueTypes(plan: CommissionPlan): RevenueType[] {
  return plan.revenueTypes.filter((r) => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Variant with retroactive accelerators on every rule. */
export function retroactiveVariant(plan: CommissionPlan): CommissionPlan {
  return {
    ...plan,
    name: `${plan.name} – Retroactive proposal`,
    rules: plan.rules.map((r) => ({ ...r, accelerationMethod: "retroactive" })),
  };
}

/** Variant with 50% richer accelerators above quota. */
export function aggressiveVariant(plan: CommissionPlan): CommissionPlan {
  return {
    ...plan,
    name: "Aggressive Growth Plan",
    features: { ...plan.features, accelerators: true },
    rules: plan.rules.map((r) => ({
      ...r,
      acceleratorRate: r.acceleratorRate * 1.5,
      tiers: r.tiers.map((t) => (t.fromPct >= 100 ? { ...t, rate: t.rate * 1.5 } : t)),
    })),
  };
}

export function touch(plan: CommissionPlan): CommissionPlan {
  return { ...plan, updatedAt: new Date().toISOString() };
}
