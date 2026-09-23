"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, NumberInput } from "@/components/ui/controls";
import { Alert, Badge, Card, DataTable, EmptyState, FeatureCard, PageHeader, Td, Th } from "@/components/ui/layout";
import { useCalculation, useMoney } from "@/hooks/useCalculation";
import { usePlan } from "@/hooks/usePlan";
import { getRampPct } from "@/lib/commission-engine/calculateQuotaAttainment";
import { dec, round2 } from "@/lib/commission-engine/money";
import { activePeriods } from "@/lib/commission-engine/periods";
import type { CommissionPlan, QuotaScope, RevenueType } from "@/lib/commission-engine/types";
import { currencySymbol, formatPct } from "@/lib/format/currency";
import { createId } from "@/lib/plan/ids";
import { setFeature, enabledRevenueTypes } from "@/lib/plan/planOperations";
import { setPerformance, setQuota } from "@/lib/plan/planFactory";

function quotaValue(plan: CommissionPlan, periodId: string, rtId: string, scope: QuotaScope) {
  return plan.quotas.find((q) => q.periodId === periodId && q.revenueTypeId === rtId && q.scope === scope)?.amount ?? 0;
}

function perfValue(plan: CommissionPlan, periodId: string, rtId: string, scope: QuotaScope) {
  return plan.performance.find((p) => p.periodId === periodId && p.revenueTypeId === rtId && p.scope === scope);
}

/** Splits an annual amount evenly across all periods of the year; the last period absorbs rounding. */
function distribute(plan: CommissionPlan, rtId: string, annual: number, scope: QuotaScope): CommissionPlan {
  const periods = [...plan.periods].sort((a, b) => a.index - b.index);
  const share = round2(dec(annual).div(periods.length));
  let next = plan;
  periods.forEach((p, i) => {
    const amount = i === periods.length - 1 ? dec(annual).minus(share.mul(periods.length - 1)) : share;
    next = setQuota(next, p.id, rtId, amount.toNumber(), scope);
  });
  return next;
}

function QuotaFillTools({ rt, scope }: { rt: RevenueType; scope: QuotaScope }) {
  const { plan, update } = usePlan();
  const [annual, setAnnual] = useState<number | null>(null);
  const symbol = currencySymbol(plan.currency);
  const periods = activePeriods(plan);
  if (plan.calculationPeriod === "annual") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NumberInput className="w-36" prefix={symbol} value={annual} allowNull placeholder="Annual quota" onChange={setAnnual} ariaLabel="Annual quota" />
      <Button size="sm" disabled={!annual} onClick={() => annual && update((p) => distribute(p, rt.id, annual, scope))}>
        Distribute evenly
      </Button>
      {plan.mode === "multi" && periods.length > 1 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            update((p) => {
              const first = quotaValue(p, periods[0].id, rt.id, scope);
              return periods.reduce((acc, per) => setQuota(acc, per.id, rt.id, first, scope), p);
            })
          }
        >
          Copy first period to all
        </Button>
      )}
    </div>
  );
}

function QuotaTable({ rt, scope }: { rt: RevenueType; scope: QuotaScope }) {
  const { plan, update } = usePlan();
  const result = useCalculation(plan);
  const { fmt0 } = useMoney(plan.currency);
  const symbol = currencySymbol(plan.currency);
  const periods = activePeriods(plan);
  const showRamp = scope === "individual" && plan.features.ramp;
  const rule = plan.rules.find((r) => r.revenueTypeId === rt.id);
  const showExcluded = !rt.quotaBased && rule?.requireInPeriod;

  let totalQuota = dec(0);
  let totalAdjusted = dec(0);
  let totalActual = dec(0);

  const rows = periods.map((period, position) => {
    const q = quotaValue(plan, period.id, rt.id, scope);
    const perf = perfValue(plan, period.id, rt.id, scope);
    const rampPct = showRamp ? getRampPct(plan.ramp, position) : 100;
    const adjusted = round2(dec(q).mul(rampPct).div(100)).toNumber();
    const pr = result.periods[position];
    const typeResult = pr?.revenueTypes.find((r) => r.revenueTypeId === rt.id);
    const attainment = scope === "team" ? (q > 0 ? ((perf?.actual ?? 0) / q) * 100 : null) : typeResult?.attainmentPct ?? null;
    totalQuota = totalQuota.plus(q);
    totalAdjusted = totalAdjusted.plus(adjusted);
    totalActual = totalActual.plus(perf?.actual ?? 0);
    return { period, q, perf, rampPct, adjusted, attainment };
  });

  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Period</Th>
          {rt.quotaBased && <Th align="right">{showRamp ? "Full quota" : "Quota"}</Th>}
          {rt.quotaBased && showRamp && <Th align="right">Ramp</Th>}
          {rt.quotaBased && showRamp && <Th align="right">Ramp-adjusted quota</Th>}
          <Th align="right">Actual</Th>
          {showExcluded && <Th align="right">Excluded (outside period)</Th>}
          {rt.quotaBased && <Th align="right">Attainment</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ period, q, perf, rampPct, adjusted, attainment }) => (
          <tr key={period.id}>
            <Td className="font-medium text-slate-700">{period.label}</Td>
            {rt.quotaBased && (
              <Td align="right" className="w-44">
                <NumberInput
                  ariaLabel={`${rt.label} quota ${period.label}`}
                  prefix={symbol}
                  min={0}
                  value={q}
                  onChange={(v) => update((p) => setQuota(p, period.id, rt.id, v ?? 0, scope))}
                />
              </Td>
            )}
            {rt.quotaBased && showRamp && (
              <Td align="right" className="text-slate-500">
                {rampPct}%
              </Td>
            )}
            {rt.quotaBased && showRamp && <Td align="right">{fmt0(adjusted)}</Td>}
            <Td align="right" className="w-44">
              <NumberInput
                ariaLabel={`${rt.label} actual ${period.label}`}
                prefix={symbol}
                value={perf?.actual ?? 0}
                onChange={(v) => update((p) => setPerformance(p, period.id, rt.id, { actual: v ?? 0 }, scope))}
              />
            </Td>
            {showExcluded && (
              <Td align="right" className="w-44">
                <NumberInput
                  ariaLabel={`${rt.label} excluded ${period.label}`}
                  prefix={symbol}
                  min={0}
                  value={perf?.excludedAmount ?? 0}
                  onChange={(v) => update((p) => setPerformance(p, period.id, rt.id, { excludedAmount: v ?? 0 }, scope))}
                />
              </Td>
            )}
            {rt.quotaBased && (
              <Td align="right" className="w-28">
                <span className={attainment !== null && attainment >= 100 ? "font-medium text-emerald-700" : "text-slate-700"}>
                  {formatPct(attainment)}
                </span>
              </Td>
            )}
          </tr>
        ))}
        {periods.length > 1 && (
          <tr className="bg-slate-50 font-medium">
            <Td>Total</Td>
            {rt.quotaBased && <Td align="right">{fmt0(totalQuota.toNumber())}</Td>}
            {rt.quotaBased && showRamp && <Td />}
            {rt.quotaBased && showRamp && <Td align="right">{fmt0(totalAdjusted.toNumber())}</Td>}
            <Td align="right">{fmt0(totalActual.toNumber())}</Td>
            {showExcluded && <Td />}
            {rt.quotaBased && (
              <Td align="right">
                {formatPct(
                  (showRamp ? totalAdjusted : totalQuota).gt(0)
                    ? totalActual.div(showRamp ? totalAdjusted : totalQuota).mul(100).toNumber()
                    : null,
                )}
              </Td>
            )}
          </tr>
        )}
      </tbody>
    </DataTable>
  );
}

function RampEditor() {
  const { plan, update } = usePlan();
  const steps = [...plan.ramp.steps].sort((a, b) => a.periodNumber - b.periodNumber);
  const unit = { monthly: "Month", quarterly: "Quarter", half_year: "Half-year", annual: "Year" }[plan.calculationPeriod];
  const setSteps = (next: typeof steps) => update((p) => ({ ...p, ramp: { ...p.ramp, steps: next } }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Rep's tenure in the first modeled period`} hint={`${unit} number of employment, e.g. 1 = first ${unit.toLowerCase()} after hire.`}>
          <NumberInput
            min={1}
            value={plan.ramp.firstPeriodNumber}
            onChange={(v) => update((p) => ({ ...p, ramp: { ...p.ramp, firstPeriodNumber: Math.max(1, Math.round(v ?? 1)) } }))}
          />
        </Field>
      </div>
      <DataTable>
        <thead>
          <tr>
            <Th>{unit} of tenure</Th>
            <Th align="right">Quota %</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.id}>
              <Td className="w-40">
                <NumberInput
                  min={1}
                  value={s.periodNumber}
                  onChange={(v) => setSteps(steps.map((x) => (x.id === s.id ? { ...x, periodNumber: Math.max(1, Math.round(v ?? 1)) } : x)))}
                />
              </Td>
              <Td align="right" className="w-40">
                <NumberInput suffix="%" min={0} value={s.pct} onChange={(v) => setSteps(steps.map((x) => (x.id === s.id ? { ...x, pct: v ?? 0 } : x)))} />
              </Td>
              <Td align="right">
                <Button variant="ghost" size="sm" aria-label="Remove step" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Td>
            </tr>
          ))}
          <tr>
            <Td colSpan={3} className="text-xs text-slate-500">
              {unit} {(steps[steps.length - 1]?.periodNumber ?? 0) + 1}+ uses 100% of quota.
            </Td>
          </tr>
        </tbody>
      </DataTable>
      <Button
        size="sm"
        onClick={() => {
          const last = steps[steps.length - 1];
          setSteps([...steps, { id: createId("ramp"), periodNumber: (last?.periodNumber ?? 0) + 1, pct: Math.min(100, (last?.pct ?? 0) + 25) }]);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add ramp step
      </Button>
    </div>
  );
}

export default function QuotaPage() {
  const { plan, update } = usePlan();
  const types = enabledRevenueTypes(plan);
  const quotaTypes = types.filter((t) => t.quotaBased);
  const flatTypes = types.filter((t) => !t.quotaBased);
  const weightSum = plan.team.individualWeight + plan.team.teamWeight;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quota & performance"
        description={
          plan.mode === "single"
            ? "Enter the quota and aggregated actual results for the selected period. No individual deals required."
            : "Enter quotas and aggregated actuals for each period. Each period is calculated independently."
        }
      />

      {types.length === 0 && <EmptyState>No revenue types enabled. Enable at least one on the Revenue types page.</EmptyState>}

      {quotaTypes.map((rt) => (
        <Card
          key={rt.id}
          title={
            <span className="flex items-center gap-2">
              {rt.label} <Badge tone="brand">Quota-based</Badge>
              {rt.weighting !== 100 && <Badge>{rt.weighting}% credit</Badge>}
            </span>
          }
          description="Individual quota and actual performance."
          actions={<QuotaFillTools rt={rt} scope="individual" />}
          bodyClassName="p-0"
        >
          <QuotaTable rt={rt} scope="individual" />
        </Card>
      ))}

      {flatTypes.map((rt) => (
        <Card
          key={rt.id}
          title={
            <span className="flex items-center gap-2">
              {rt.label} <Badge>Flat rate, no quota</Badge>
            </span>
          }
          description="Commissioned separately from the main quota structure."
          bodyClassName="p-0"
        >
          <QuotaTable rt={rt} scope="individual" />
        </Card>
      ))}

      <FeatureCard
        title="Enable ramping"
        description="Reduce quota for new sales reps during their first periods (e.g. 25% → 50% → 75% → 100%)."
        enabled={plan.features.ramp}
        onToggle={(v) => update((p) => setFeature(p, "ramp", v))}
      >
        <RampEditor />
      </FeatureCard>

      <FeatureCard
        title="Enable team quota"
        description="Base part of variable compensation on team performance (e.g. 70% individual / 30% team)."
        enabled={plan.features.team}
        onToggle={(v) => update((p) => setFeature(p, "team", v))}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Individual weight">
              <NumberInput suffix="%" min={0} max={100} value={plan.team.individualWeight} onChange={(v) => update((p) => ({ ...p, team: { ...p.team, individualWeight: v ?? 0 } }))} />
            </Field>
            <Field label="Team weight">
              <NumberInput suffix="%" min={0} max={100} value={plan.team.teamWeight} onChange={(v) => update((p) => ({ ...p, team: { ...p.team, teamWeight: v ?? 0 } }))} />
            </Field>
          </div>
          {weightSum !== 100 && <Alert tone="warning">Weights total {weightSum}%. They should add up to 100%.</Alert>}
          <Alert>
            Individual commission from the rules is multiplied by the individual weight. The team component pays team weight × target
            variable × team payout factor, where the factor is team commission at actual ÷ team commission at quota using the same rules.
            Set target variable on the Compensation page.
          </Alert>
          {quotaTypes.map((rt) => (
            <div key={rt.id} className="rounded-md border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <span className="text-sm font-medium text-slate-800">Team {rt.label}</span>
                <QuotaFillTools rt={rt} scope="team" />
              </div>
              <QuotaTable rt={rt} scope="team" />
            </div>
          ))}
        </div>
      </FeatureCard>
    </div>
  );
}
