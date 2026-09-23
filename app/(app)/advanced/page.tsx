"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Field, NumberInput, Segmented, Select, TextInput } from "@/components/ui/controls";
import { Alert, DataTable, EmptyState, FeatureCard, PageHeader, Td, Th } from "@/components/ui/layout";
import { useCalculation, useMoney } from "@/hooks/useCalculation";
import { usePlan } from "@/hooks/usePlan";
import { clawbackAmount } from "@/lib/commission-engine/calculateClawbacks";
import { validateSplits } from "@/lib/commission-engine/calculateSplitCommission";
import { activePeriods } from "@/lib/commission-engine/periods";
import type {
  BonusEvaluation,
  ClawbackTrigger,
  CommissionPlan,
  DrawType,
  FeatureToggles,
  GuaranteeScope,
} from "@/lib/commission-engine/types";
import { currencySymbol, formatPct } from "@/lib/format/currency";
import { createId } from "@/lib/plan/ids";
import { setFeature } from "@/lib/plan/planOperations";

const TRIGGER_LABELS: Record<ClawbackTrigger, string> = {
  churn: "Customer churn",
  non_payment: "Customer non-payment",
  cancellation: "Contract cancellation",
};

/** Enables a feature and seeds sensible defaults the first time it is turned on. */
function enableWithDefaults(plan: CommissionPlan, key: keyof FeatureToggles, value: boolean): CommissionPlan {
  let next = setFeature(plan, key, value);
  if (!value) return next;
  if (key === "bonuses" && next.bonuses.length === 0) {
    next = {
      ...next,
      bonuses: [
        { id: createId("bonus"), planId: plan.id, attainmentPct: 100, amount: 2000 },
        { id: createId("bonus"), planId: plan.id, attainmentPct: 125, amount: 3000 },
        { id: createId("bonus"), planId: plan.id, attainmentPct: 150, amount: 5000 },
      ],
    };
  }
  if (key === "clawbacks" && next.clawbackRules.length === 0) {
    next = {
      ...next,
      clawbackRules: [
        { id: createId("cbr"), planId: plan.id, trigger: "churn", withinDays: 90, pct: 100 },
        { id: createId("cbr"), planId: plan.id, trigger: "churn", withinDays: 180, pct: 50 },
      ],
    };
  }
  if (key === "splits" && next.splits.length === 0) {
    next = {
      ...next,
      splits: [
        { id: createId("split"), planId: plan.id, role: "Account Executive", pct: 70 },
        { id: createId("split"), planId: plan.id, role: "SDR", pct: 20 },
        { id: createId("split"), planId: plan.id, role: "Sales Engineer", pct: 10 },
      ],
    };
  }
  if (key === "draw" && next.draw.amountPerPeriod === 0) next = { ...next, draw: { ...next.draw, amountPerPeriod: 3000 } };
  if (key === "guarantee" && next.guarantee.amountPerPeriod === 0) {
    next = { ...next, guarantee: { ...next.guarantee, amountPerPeriod: 2000 } };
  }
  return next;
}

function Bonuses() {
  const { plan, update } = usePlan();
  const symbol = currencySymbol(plan.currency);
  const bonuses = [...plan.bonuses].sort((a, b) => a.attainmentPct - b.attainmentPct);
  const set = (id: string, patch: Partial<(typeof bonuses)[number]>) =>
    update((p) => ({ ...p, bonuses: p.bonuses.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  return (
    <div className="space-y-4">
      {plan.mode === "multi" && (
        <Field group label="Evaluate milestones">
          <Segmented<BonusEvaluation>
            value={plan.bonusEvaluation}
            onChange={(bonusEvaluation) => update((p) => ({ ...p, bonusEvaluation }))}
            options={[
              { value: "per_period", label: "Each period" },
              { value: "annual", label: "On total attainment (paid in last period)" },
            ]}
          />
        </Field>
      )}
      <DataTable>
        <thead>
          <tr>
            <Th>Attainment reached</Th>
            <Th align="right">Bonus amount</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b) => (
            <tr key={b.id}>
              <Td className="w-40">
                <NumberInput ariaLabel="Bonus milestone attainment" suffix="%" min={0} value={b.attainmentPct} onChange={(v) => set(b.id, { attainmentPct: v ?? 0 })} />
              </Td>
              <Td align="right" className="w-44">
                <NumberInput ariaLabel="Bonus amount" prefix={symbol} min={0} value={b.amount} onChange={(v) => set(b.id, { amount: v ?? 0 })} />
              </Td>
              <Td align="right">
                <Button variant="ghost" size="sm" aria-label="Remove bonus" onClick={() => update((p) => ({ ...p, bonuses: p.bonuses.filter((x) => x.id !== b.id) }))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          onClick={() =>
            update((p) => ({
              ...p,
              bonuses: [...p.bonuses, { id: createId("bonus"), planId: p.id, attainmentPct: (bonuses[bonuses.length - 1]?.attainmentPct ?? 75) + 25, amount: 1000 }],
            }))
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add milestone
        </Button>
        <span className="text-xs text-slate-500">Milestones stack: reaching 125% pays both the 100% and 125% bonuses.</span>
      </div>
    </div>
  );
}

function Clawbacks() {
  const { plan, update } = usePlan();
  const { fmt } = useMoney(plan.currency);
  const symbol = currencySymbol(plan.currency);
  const periods = activePeriods(plan);
  const setRule = (id: string, patch: Partial<CommissionPlan["clawbackRules"][number]>) =>
    update((p) => ({ ...p, clawbackRules: p.clawbackRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const setEntry = (id: string, patch: Partial<CommissionPlan["clawbackEntries"][number]>) =>
    update((p) => ({ ...p, clawbackEntries: p.clawbackEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const visibleEntries = plan.clawbackEntries.filter((e) => periods.some((p) => p.id === e.periodId));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clawback policy</h3>
        <DataTable>
          <thead>
            <tr>
              <Th>Trigger</Th>
              <Th align="right">Within (days)</Th>
              <Th align="right">Clawed back</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {plan.clawbackRules.map((r) => (
              <tr key={r.id}>
                <Td className="w-56">
                  <Select<ClawbackTrigger>
                    value={r.trigger}
                    onChange={(trigger) => setRule(r.id, { trigger })}
                    options={(Object.keys(TRIGGER_LABELS) as ClawbackTrigger[]).map((t) => ({ value: t, label: TRIGGER_LABELS[t] }))}
                  />
                </Td>
                <Td align="right" className="w-32">
                  <NumberInput ariaLabel="Clawback window in days" min={0} value={r.withinDays} onChange={(v) => setRule(r.id, { withinDays: Math.round(v ?? 0) })} />
                </Td>
                <Td align="right" className="w-32">
                  <NumberInput ariaLabel="Clawback percentage" suffix="%" min={0} max={100} value={r.pct} onChange={(v) => setRule(r.id, { pct: v ?? 0 })} />
                </Td>
                <Td align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove rule"
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        clawbackRules: p.clawbackRules.filter((x) => x.id !== r.id),
                        clawbackEntries: p.clawbackEntries.map((e) => (e.clawbackRuleId === r.id ? { ...e, clawbackRuleId: null } : e)),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <Button
          size="sm"
          onClick={() =>
            update((p) => ({
              ...p,
              clawbackRules: [...p.clawbackRules, { id: createId("cbr"), planId: p.id, trigger: "non_payment", withinDays: 90, pct: 100 }],
            }))
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add policy rule
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clawback adjustments</h3>
        <p className="text-xs text-slate-500">
          Enter aggregated clawbacks per period: the original commission paid on affected deals and the policy rule that applies.
        </p>
        {visibleEntries.length === 0 ? (
          <EmptyState>No clawback adjustments.</EmptyState>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Period</Th>
                <Th>Rule</Th>
                <Th align="right">Original commission</Th>
                <Th>Note</Th>
                <Th align="right">Clawback</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={e.id}>
                  <Td className="w-28">
                    <Select value={e.periodId} onChange={(periodId) => setEntry(e.id, { periodId })} options={periods.map((p) => ({ value: p.id, label: p.label }))} />
                  </Td>
                  <Td className="w-64">
                    <Select
                      value={e.clawbackRuleId ?? ""}
                      onChange={(v) => setEntry(e.id, { clawbackRuleId: v || null })}
                      options={[
                        { value: "", label: "Direct amount (100%)" },
                        ...plan.clawbackRules.map((r) => ({ value: r.id, label: `${TRIGGER_LABELS[r.trigger]} ≤ ${r.withinDays}d (${r.pct}%)` })),
                      ]}
                    />
                  </Td>
                  <Td align="right" className="w-40">
                    <NumberInput ariaLabel="Original commission" prefix={symbol} min={0} value={e.commissionAmount} onChange={(v) => setEntry(e.id, { commissionAmount: v ?? 0 })} />
                  </Td>
                  <Td className="min-w-40">
                    <TextInput value={e.note} onChange={(note) => setEntry(e.id, { note })} placeholder="Optional" />
                  </Td>
                  <Td align="right" className="font-medium text-red-600">
                    −{fmt(clawbackAmount(e, plan.clawbackRules))}
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove adjustment"
                      onClick={() => update((p) => ({ ...p, clawbackEntries: p.clawbackEntries.filter((x) => x.id !== e.id) }))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <Button
          size="sm"
          disabled={periods.length === 0}
          onClick={() =>
            update((p) => ({
              ...p,
              clawbackEntries: [
                ...p.clawbackEntries,
                {
                  id: createId("cbe"),
                  planId: p.id,
                  periodId: periods[0].id,
                  clawbackRuleId: p.clawbackRules[0]?.id ?? null,
                  commissionAmount: 0,
                  note: "",
                },
              ],
            }))
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add adjustment
        </Button>
      </div>
    </div>
  );
}

function Splits() {
  const { plan, update } = usePlan();
  const result = useCalculation(plan);
  const { fmt } = useMoney(plan.currency);
  const errors = validateSplits(plan.splits);
  const total = plan.splits.reduce((a, s) => a + s.pct, 0);
  const set = (id: string, patch: Partial<CommissionPlan["splits"][number]>) =>
    update((p) => ({ ...p, splits: p.splits.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <div className="space-y-3">
      <DataTable>
        <thead>
          <tr>
            <Th>Role</Th>
            <Th align="right">Share</Th>
            <Th align="right">Payout</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {plan.splits.map((s) => (
            <tr key={s.id}>
              <Td className="min-w-48">
                <TextInput value={s.role} onChange={(role) => set(s.id, { role })} ariaLabel="Role" />
              </Td>
              <Td align="right" className="w-32">
                <NumberInput ariaLabel={`${s.role} share`} suffix="%" min={0} max={100} value={s.pct} onChange={(v) => set(s.id, { pct: v ?? 0 })} />
              </Td>
              <Td align="right" className="w-36">
                {fmt(result.splits?.lines.find((l) => l.splitRuleId === s.id)?.amount ?? 0)}
              </Td>
              <Td align="right">
                <Button variant="ghost" size="sm" aria-label="Remove role" onClick={() => update((p) => ({ ...p, splits: p.splits.filter((x) => x.id !== s.id) }))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-medium">
            <Td>Total</Td>
            <Td align="right" className={errors.length ? "text-red-600" : "text-emerald-700"}>
              {formatPct(total, 2)}
            </Td>
            <Td align="right">{fmt(result.splits?.pool ?? 0)}</Td>
            <Td />
          </tr>
        </tbody>
      </DataTable>
      {errors.length > 0 && <Alert tone="error">{errors.join(" ")}</Alert>}
      <Button size="sm" onClick={() => update((p) => ({ ...p, splits: [...p.splits, { id: createId("split"), planId: p.id, role: "New role", pct: 0 }] }))}>
        <Plus className="h-3.5 w-3.5" />
        Add role
      </Button>
      <p className="text-xs text-slate-500">The split pool is net variable earned (commission + bonuses + guarantee − clawbacks).</p>
    </div>
  );
}

export default function AdvancedPage() {
  const { plan, update } = usePlan();
  const symbol = currencySymbol(plan.currency);
  const toggle = (key: keyof FeatureToggles) => (v: boolean) => update((p) => enableWithDefaults(p, key, v));
  const perPeriod = { monthly: "month", quarterly: "quarter", half_year: "half-year", annual: "year" }[plan.calculationPeriod];

  return (
    <div className="space-y-4">
      <PageHeader title="Advanced rules" description="Optional plan components. Enable only what applies; settings appear when a feature is on." />

      <FeatureCard
        title="Enable bonuses"
        description="Fixed bonuses triggered by quota attainment milestones."
        enabled={plan.features.bonuses}
        onToggle={toggle("bonuses")}
      >
        <Bonuses />
      </FeatureCard>

      <FeatureCard
        title="Enable guaranteed commission"
        description="If calculated variable pay is lower than the guarantee, pay the guaranteed amount."
        enabled={plan.features.guarantee}
        onToggle={toggle("guarantee")}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Guaranteed amount per ${perPeriod}`}>
            <NumberInput
              prefix={symbol}
              min={0}
              value={plan.guarantee.amountPerPeriod}
              onChange={(v) => update((p) => ({ ...p, guarantee: { ...p.guarantee, amountPerPeriod: v ?? 0 } }))}
            />
          </Field>
          <Field label="Applies to">
            <Select<GuaranteeScope>
              value={plan.guarantee.appliesTo}
              onChange={(appliesTo) => update((p) => ({ ...p, guarantee: { ...p.guarantee, appliesTo } }))}
              options={[
                { value: "ramp_periods", label: "Ramp periods only" },
                { value: "all_periods", label: "All periods" },
              ]}
            />
          </Field>
        </div>
        {plan.guarantee.appliesTo === "ramp_periods" && !plan.features.ramp && (
          <div className="mt-3">
            <Alert tone="warning">Ramping is disabled, so no period qualifies. Enable ramping on the Quota page or apply to all periods.</Alert>
          </div>
        )}
      </FeatureCard>

      <FeatureCard
        title="Enable draw against commission"
        description="Advance a fixed amount each period; earnings above the draw are paid out."
        enabled={plan.features.draw}
        onToggle={toggle("draw")}
      >
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Draw per ${perPeriod}`}>
              <NumberInput prefix={symbol} min={0} value={plan.draw.amountPerPeriod} onChange={(v) => update((p) => ({ ...p, draw: { ...p.draw, amountPerPeriod: v ?? 0 } }))} />
            </Field>
            <Field group label="Draw type">
              <Segmented<DrawType>
                value={plan.draw.type}
                onChange={(type) => update((p) => ({ ...p, draw: { ...p.draw, type } }))}
                options={[
                  { value: "recoverable", label: "Recoverable" },
                  { value: "non_recoverable", label: "Non-recoverable" },
                ]}
              />
            </Field>
          </div>
          <Alert>
            {plan.draw.type === "recoverable"
              ? "Recoverable: when earnings are below the draw, the shortfall carries forward and is recovered from future earnings above the draw."
              : "Non-recoverable: when earnings are below the draw, the shortfall is forgiven."}
          </Alert>
        </div>
      </FeatureCard>

      <FeatureCard
        title="Enable clawbacks"
        description="Recover commission on churned, unpaid or cancelled deals, entered as aggregated adjustments."
        enabled={plan.features.clawbacks}
        onToggle={toggle("clawbacks")}
      >
        <Clawbacks />
      </FeatureCard>

      <FeatureCard
        title="Enable split commissions"
        description="Split the commission between roles (e.g. AE 70%, SDR 20%, SE 10%)."
        enabled={plan.features.splits}
        onToggle={toggle("splits")}
      >
        <Splits />
      </FeatureCard>
    </div>
  );
}
