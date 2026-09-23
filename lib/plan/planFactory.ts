import { generatePeriods } from "@/lib/commission-engine/periods";
import {
  SCHEMA_VERSION,
  type CommissionPlan,
  type CommissionRule,
  type CommissionTier,
  type PerformanceData,
  type Quota,
  type QuotaScope,
  type RevenueType,
  type RevenueTypeKey,
} from "@/lib/commission-engine/types";
import { createId } from "./ids";

interface RevenueTypeDefault {
  key: RevenueTypeKey;
  label: string;
  quotaBased: boolean;
  rate: number;
}

export const REVENUE_TYPE_DEFAULTS: RevenueTypeDefault[] = [
  { key: "new_arr", label: "New ARR", quotaBased: true, rate: 10 },
  { key: "new_mrr", label: "New MRR", quotaBased: true, rate: 10 },
  { key: "acv", label: "ACV", quotaBased: true, rate: 10 },
  { key: "tcv", label: "TCV", quotaBased: true, rate: 5 },
  { key: "one_time", label: "One-time revenue", quotaBased: false, rate: 5 },
  { key: "expansion", label: "Expansion ARR", quotaBased: true, rate: 7 },
  { key: "upsell", label: "Upsell", quotaBased: false, rate: 7 },
  { key: "cross_sell", label: "Cross-sell", quotaBased: false, rate: 7 },
  { key: "renewal", label: "Renewal ARR", quotaBased: false, rate: 2 },
];

export function createTier(fromPct: number, toPct: number | null, rate: number): CommissionTier {
  return { id: createId("tier"), fromPct, toPct, rate };
}

export function createRule(planId: string, revenueTypeId: string, baseRate: number): CommissionRule {
  return {
    id: createId("rule"),
    planId,
    revenueTypeId,
    accelerationMethod: "marginal",
    baseRate,
    acceleratorFromPct: 100,
    acceleratorRate: baseRate * 1.5,
    tiers: [createTier(0, 100, baseRate), createTier(100, null, baseRate * 1.5)],
    thresholdPct: 0,
    maxPayoutPerPeriod: null,
    maxAttainmentPct: null,
    requireInPeriod: false,
  };
}

export function createBlankPlan(name = "New plan"): CommissionPlan {
  const id = createId("plan");
  const now = new Date().toISOString();
  const revenueTypes: RevenueType[] = REVENUE_TYPE_DEFAULTS.map((d, i) => ({
    id: createId("rt"),
    planId: id,
    key: d.key,
    label: d.label,
    enabled: d.key === "new_arr",
    quotaBased: d.quotaBased,
    weighting: 100,
    sortOrder: i,
  }));
  const rules = revenueTypes.map((rt, i) => createRule(id, rt.id, REVENUE_TYPE_DEFAULTS[i].rate));
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    description: "",
    currency: "USD",
    calculationPeriod: "quarterly",
    mode: "single",
    singlePeriodIndex: 0,
    payoutFrequency: "quarterly",
    configMode: "simple",
    primaryMetric: "arr",
    features: {
      accelerators: false,
      threshold: false,
      caps: false,
      bonuses: false,
      team: false,
      ramp: false,
      clawbacks: false,
      draw: false,
      guarantee: false,
      splits: false,
    },
    periods: generatePeriods(id, "quarterly"),
    revenueTypes,
    rules,
    quotas: [],
    performance: [],
    ramp: {
      firstPeriodNumber: 1,
      steps: [
        { id: createId("ramp"), periodNumber: 1, pct: 25 },
        { id: createId("ramp"), periodNumber: 2, pct: 50 },
        { id: createId("ramp"), periodNumber: 3, pct: 75 },
      ],
    },
    team: { individualWeight: 70, teamWeight: 30 },
    cap: { maxTotalPayout: null },
    bonusEvaluation: "per_period",
    bonuses: [],
    clawbackRules: [],
    clawbackEntries: [],
    draw: { type: "recoverable", amountPerPeriod: 0 },
    guarantee: { amountPerPeriod: 0, appliesTo: "ramp_periods" },
    splits: [],
    ote: { baseSalary: 0, targetVariable: 0, employerOverheadPct: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Upserts a quota value, returning a new plan. */
export function setQuota(
  plan: CommissionPlan,
  periodId: string,
  revenueTypeId: string,
  amount: number,
  scope: QuotaScope = "individual",
): CommissionPlan {
  const existing = plan.quotas.find(
    (q) => q.periodId === periodId && q.revenueTypeId === revenueTypeId && q.scope === scope,
  );
  const quotas: Quota[] = existing
    ? plan.quotas.map((q) => (q === existing ? { ...q, amount } : q))
    : [...plan.quotas, { id: createId("quota"), planId: plan.id, periodId, revenueTypeId, scope, amount }];
  return { ...plan, quotas };
}

/** Upserts a performance value, returning a new plan. */
export function setPerformance(
  plan: CommissionPlan,
  periodId: string,
  revenueTypeId: string,
  values: Partial<Pick<PerformanceData, "actual" | "excludedAmount">>,
  scope: QuotaScope = "individual",
): CommissionPlan {
  const existing = plan.performance.find(
    (p) => p.periodId === periodId && p.revenueTypeId === revenueTypeId && p.scope === scope,
  );
  const performance: PerformanceData[] = existing
    ? plan.performance.map((p) => (p === existing ? { ...p, ...values } : p))
    : [
        ...plan.performance,
        {
          id: createId("perf"),
          planId: plan.id,
          periodId,
          revenueTypeId,
          scope,
          actual: values.actual ?? 0,
          excludedAmount: values.excludedAmount ?? 0,
        },
      ];
  return { ...plan, performance };
}

export function revenueTypeByKey(plan: CommissionPlan, key: RevenueTypeKey): RevenueType {
  const rt = plan.revenueTypes.find((r) => r.key === key);
  if (!rt) throw new Error(`Revenue type ${key} not found`);
  return rt;
}

export function ruleFor(plan: CommissionPlan, revenueTypeId: string): CommissionRule {
  const rule = plan.rules.find((r) => r.revenueTypeId === revenueTypeId);
  if (!rule) throw new Error(`Rule for ${revenueTypeId} not found`);
  return rule;
}

/** Deep clone with fresh ids for the plan and all child entities. */
export function clonePlanWithNewIds(plan: CommissionPlan, name?: string, id = createId("plan")): CommissionPlan {
  const now = new Date().toISOString();
  const rtMap = new Map<string, string>();
  const revenueTypes = plan.revenueTypes.map((rt) => {
    const newId = createId("rt");
    rtMap.set(rt.id, newId);
    return { ...rt, id: newId, planId: id };
  });
  const clawbackRuleMap = new Map<string, string>();
  const clawbackRules = plan.clawbackRules.map((r) => {
    const newId = createId("cbr");
    clawbackRuleMap.set(r.id, newId);
    return { ...r, id: newId, planId: id };
  });
  const mapRt = (rtId: string) => rtMap.get(rtId) ?? rtId;
  return {
    ...structuredClone(plan),
    id,
    name: name ?? plan.name,
    periods: plan.periods.map((p) => ({ ...p, planId: id })),
    revenueTypes,
    rules: plan.rules.map((r) => ({
      ...r,
      id: createId("rule"),
      planId: id,
      revenueTypeId: mapRt(r.revenueTypeId),
      tiers: r.tiers.map((t) => ({ ...t, id: createId("tier") })),
    })),
    quotas: plan.quotas.map((q) => ({ ...q, id: createId("quota"), planId: id, revenueTypeId: mapRt(q.revenueTypeId) })),
    performance: plan.performance.map((p) => ({
      ...p,
      id: createId("perf"),
      planId: id,
      revenueTypeId: mapRt(p.revenueTypeId),
    })),
    ramp: { ...plan.ramp, steps: plan.ramp.steps.map((s) => ({ ...s, id: createId("ramp") })) },
    bonuses: plan.bonuses.map((b) => ({ ...b, id: createId("bonus"), planId: id })),
    clawbackRules,
    clawbackEntries: plan.clawbackEntries.map((e) => ({
      ...e,
      id: createId("cbe"),
      planId: id,
      clawbackRuleId: e.clawbackRuleId ? clawbackRuleMap.get(e.clawbackRuleId) ?? null : null,
    })),
    splits: plan.splits.map((s) => ({ ...s, id: createId("split"), planId: id })),
    createdAt: now,
    updatedAt: now,
  };
}
