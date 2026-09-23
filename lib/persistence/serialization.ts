import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { SCHEMA_VERSION, type CommissionPlan } from "@/lib/commission-engine/types";
import { createBlankPlan } from "@/lib/plan/planFactory";

export const EXPORT_FORMAT = "sales-commission-plan";
export const MAX_SHARE_URL_LENGTH = 4000;

export interface PlanExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  plan: CommissionPlan;
}

export type ParseResult = { ok: true; plan: CommissionPlan } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const REQUIRED_ARRAYS = [
  "periods",
  "revenueTypes",
  "rules",
  "quotas",
  "performance",
  "bonuses",
  "clawbackRules",
  "clawbackEntries",
  "splits",
] as const;

/**
 * Validates an unknown value as a commission plan and fills any missing optional
 * sections with defaults, so older or hand-edited files still load.
 */
export function parsePlan(value: unknown): ParseResult {
  if (!isRecord(value)) return { ok: false, error: "File does not contain a plan object." };
  const data = isRecord(value.plan) && value.format === EXPORT_FORMAT ? value.plan : value;
  if (!isRecord(data)) return { ok: false, error: "Plan is not an object." };
  if (typeof data.id !== "string" || !data.id) return { ok: false, error: "Plan is missing an id." };
  if (typeof data.name !== "string") return { ok: false, error: "Plan is missing a name." };
  if (isNum(data.schemaVersion) && data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Plan uses a newer schema (v${data.schemaVersion}) than this app supports.` };
  }
  for (const key of REQUIRED_ARRAYS) {
    if (data[key] !== undefined && !Array.isArray(data[key])) return { ok: false, error: `"${key}" must be a list.` };
  }
  if (!Array.isArray(data.revenueTypes) || !Array.isArray(data.rules) || !Array.isArray(data.periods)) {
    return { ok: false, error: "Plan is missing revenue types, rules or periods." };
  }
  for (const rule of data.rules) {
    if (!isRecord(rule) || typeof rule.revenueTypeId !== "string" || !Array.isArray(rule.tiers)) {
      return { ok: false, error: "A commission rule is malformed." };
    }
    for (const tier of rule.tiers) {
      if (!isRecord(tier) || !isNum(tier.fromPct) || !isNum(tier.rate) || !(tier.toPct === null || isNum(tier.toPct))) {
        return { ok: false, error: "A commission tier is malformed." };
      }
    }
  }
  for (const key of ["quotas", "performance"] as const) {
    const list = (data[key] ?? []) as unknown[];
    for (const row of list) {
      if (!isRecord(row) || typeof row.periodId !== "string" || typeof row.revenueTypeId !== "string") {
        return { ok: false, error: `An entry in "${key}" is malformed.` };
      }
    }
  }

  const defaults = createBlankPlan();
  const d = data as Partial<CommissionPlan>;
  const plan: CommissionPlan = {
    ...defaults,
    ...d,
    schemaVersion: SCHEMA_VERSION,
    id: data.id,
    name: data.name,
    features: { ...defaults.features, ...(d.features ?? {}) },
    ramp: { ...defaults.ramp, ...(d.ramp ?? {}) },
    team: { ...defaults.team, ...(d.team ?? {}) },
    cap: { ...defaults.cap, ...(d.cap ?? {}) },
    draw: { ...defaults.draw, ...(d.draw ?? {}) },
    guarantee: { ...defaults.guarantee, ...(d.guarantee ?? {}) },
    ote: { ...defaults.ote, ...(d.ote ?? {}) },
    quotas: (d.quotas ?? []).map((q) => ({ ...q, amount: isNum(q.amount) ? q.amount : 0 })),
    performance: (d.performance ?? []).map((p) => ({
      ...p,
      actual: isNum(p.actual) ? p.actual : 0,
      excludedAmount: isNum(p.excludedAmount) ? p.excludedAmount : 0,
    })),
    bonuses: d.bonuses ?? [],
    clawbackRules: d.clawbackRules ?? [],
    clawbackEntries: d.clawbackEntries ?? [],
    splits: d.splits ?? [],
  };
  return { ok: true, plan };
}

export function planToExportFile(plan: CommissionPlan): PlanExportFile {
  return { format: EXPORT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), plan };
}

export function serializePlan(plan: CommissionPlan): string {
  return JSON.stringify(planToExportFile(plan), null, 2);
}

export function deserializePlan(json: string): ParseResult {
  try {
    return parsePlan(JSON.parse(json));
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
}

const REMAP_KEYS = new Set(["id", "planId", "revenueTypeId", "clawbackRuleId"]);

/** Replaces long ids with short ones (period ids are deterministic and kept). */
function compactIds(plan: CommissionPlan): CommissionPlan {
  const map = new Map<string, string>();
  const shortId = (id: string) => {
    if (!map.has(id)) map.set(id, map.size.toString(36));
    return map.get(id)!;
  };
  const walk = (value: unknown, key?: string): unknown => {
    if (Array.isArray(value)) return value.map((v) => walk(v));
    if (isRecord(value)) {
      if (key === "periods") return value;
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "periods" ? v : walk(v, k)]));
    }
    if (typeof value === "string" && key && REMAP_KEYS.has(key)) return shortId(value);
    return value;
  };
  const compacted = walk(plan) as CommissionPlan;
  return { ...compacted, periods: plan.periods.map((p) => ({ ...p, planId: compacted.id })) };
}

/** Drops data for disabled revenue types to keep share links short. */
function trimForShare(plan: CommissionPlan): CommissionPlan {
  const enabled = new Set(plan.revenueTypes.filter((r) => r.enabled).map((r) => r.id));
  return {
    ...plan,
    revenueTypes: plan.revenueTypes.filter((r) => enabled.has(r.id)),
    rules: plan.rules.filter((r) => enabled.has(r.revenueTypeId)),
    quotas: plan.quotas.filter((q) => enabled.has(q.revenueTypeId) && q.amount !== 0),
    performance: plan.performance.filter(
      (p) => enabled.has(p.revenueTypeId) && (p.actual !== 0 || p.excludedAmount !== 0),
    ),
  };
}

export function encodePlanForUrl(plan: CommissionPlan): string {
  return compressToEncodedURIComponent(JSON.stringify(compactIds(trimForShare(plan))));
}

export function decodePlanFromUrl(encoded: string): ParseResult {
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) return { ok: false, error: "Share link is invalid or truncated." };
  return deserializePlan(json);
}

/** Builds a share URL, or returns null when it would be too long. */
export function buildShareUrl(plan: CommissionPlan, baseUrl: string): string | null {
  const url = `${baseUrl}#plan=${encodePlanForUrl(plan)}`;
  return url.length <= MAX_SHARE_URL_LENGTH ? url : null;
}
