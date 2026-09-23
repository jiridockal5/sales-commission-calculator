"use client";

import { useMemo } from "react";
import { PayoutCurveChart } from "@/components/charts/PayoutCurveChart";
import { TierBuilder } from "@/components/forms/TierBuilder";
import { Checkbox, Field, NumberInput, Segmented, Switch } from "@/components/ui/controls";
import { Alert, Badge, Card, DataTable, EmptyState, PageHeader, Td, Th } from "@/components/ui/layout";
import { useMoney } from "@/hooks/useCalculation";
import { usePlan } from "@/hooks/usePlan";
import { calculateRevenueTypeCommission } from "@/lib/commission-engine/calculateCommission";
import { activePeriods } from "@/lib/commission-engine/periods";
import type { AccelerationMethod, CommissionPlan, CommissionRule, ConfigMode, RevenueType } from "@/lib/commission-engine/types";
import { currencySymbol } from "@/lib/format/currency";
import { enabledRevenueTypes, setFeature, updateRule } from "@/lib/plan/planOperations";

/** Representative quota for previews: first modeled period's quota, or 100,000. */
function previewQuota(plan: CommissionPlan, rt: RevenueType): number {
  const period = activePeriods(plan)[0];
  const q = plan.quotas.find((x) => x.periodId === period?.id && x.revenueTypeId === rt.id && x.scope === "individual");
  return q && q.amount > 0 ? q.amount : 100_000;
}

function useRuleCurve(plan: CommissionPlan, rt: RevenueType, rule: CommissionRule) {
  return useMemo(() => {
    const quota = previewQuota(plan, rt);
    const run = (attainment: number, method?: AccelerationMethod) =>
      calculateRevenueTypeCommission({
        revenueType: rt,
        rule: method ? { ...rule, accelerationMethod: method } : rule,
        fullQuota: quota,
        rampPct: 100,
        actual: 0,
        excludedAmount: 0,
        configMode: plan.configMode,
        features: plan.features,
        attainmentOverridePct: attainment,
      }).commission;
    const data = Array.from({ length: 81 }, (_, i) => {
      const a = i * 2.5;
      return { attainmentPct: a, payout: run(a) };
    });
    return { quota, data, at120: { marginal: run(120, "marginal"), retroactive: run(120, "retroactive") } };
  }, [plan.configMode, plan.features, rt, rule, plan]);
}

function QuotaRuleCard({ rt, rule }: { rt: RevenueType; rule: CommissionRule }) {
  const { plan, update } = usePlan();
  const { fmt0 } = useMoney(plan.currency);
  const symbol = currencySymbol(plan.currency);
  const f = plan.features;
  const patch = (p: Partial<CommissionRule>) => update((pl) => updateRule(pl, rule.id, p));
  const curve = useRuleCurve(plan, rt, rule);
  const showMethod = plan.configMode === "advanced" || f.accelerators;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {rt.label}
          <Badge tone="brand">{plan.configMode === "simple" ? "Simple" : "Tiered"}</Badge>
        </span>
      }
    >
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-3">
          {showMethod && (
            <Field
              group
              label="Accelerator calculation"
              hint={
                rule.accelerationMethod === "marginal"
                  ? "Marginal: only revenue within each tier earns that tier's rate."
                  : "Retroactive: once a tier is reached, its rate applies to all revenue."
              }
            >
              <Segmented<AccelerationMethod>
                value={rule.accelerationMethod}
                onChange={(accelerationMethod) => patch({ accelerationMethod })}
                options={[
                  { value: "marginal", label: "Marginal tiers" },
                  { value: "retroactive", label: "Retroactive" },
                ]}
              />
            </Field>
          )}

          {plan.configMode === "simple" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Base commission rate">
                <NumberInput suffix="%" min={0} value={rule.baseRate} onChange={(v) => patch({ baseRate: v ?? 0 })} />
              </Field>
              {f.accelerators && (
                <>
                  <Field label="Accelerator starts at" hint="Quota attainment">
                    <NumberInput suffix="%" min={0} value={rule.acceleratorFromPct} onChange={(v) => patch({ acceleratorFromPct: v ?? 0 })} />
                  </Field>
                  <Field label="Accelerator rate">
                    <NumberInput suffix="%" min={0} value={rule.acceleratorRate} onChange={(v) => patch({ acceleratorRate: v ?? 0 })} />
                  </Field>
                </>
              )}
            </div>
          ) : (
            <TierBuilder tiers={rule.tiers} onChange={(tiers) => patch({ tiers })} />
          )}

          {(f.threshold || f.caps) && (
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              {f.threshold && (
                <Field
                  label="Minimum threshold"
                  hint={
                    plan.configMode === "advanced"
                      ? `Currently ${rule.thresholdPct}%. A tier with a rate is still paid. Set the tier rate to 0% to pay nothing in that band.`
                      : "No commission below this attainment."
                  }
                >
                  <NumberInput suffix="%" min={0} value={rule.thresholdPct} onChange={(v) => patch({ thresholdPct: v ?? 0 })} />
                </Field>
              )}
              {f.caps && (
                <>
                  <Field label="Max payout per period" hint="Leave empty for uncapped.">
                    <NumberInput prefix={symbol} allowNull min={0} value={rule.maxPayoutPerPeriod} onChange={(v) => patch({ maxPayoutPerPeriod: v })} />
                  </Field>
                  <Field label="Max attainment counted" hint="Stops accelerating beyond this.">
                    <NumberInput suffix="%" allowNull min={0} value={rule.maxAttainmentPct} onChange={(v) => patch({ maxAttainmentPct: v })} />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-600">Payout preview</span>
            <span className="text-[11px] text-slate-400">Quota {fmt0(curve.quota)}</span>
          </div>
          <PayoutCurveChart
            data={curve.data}
            series={[{ key: "payout", name: "Commission" }]}
            currency={plan.currency}
            height={200}
            highlights={[50, 100, 150]}
          />
          {showMethod && (
            <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              At 120% attainment: marginal <span className="num font-medium text-slate-900">{fmt0(curve.at120.marginal)}</span> vs retroactive{" "}
              <span className="num font-medium text-slate-900">{fmt0(curve.at120.retroactive)}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function RulesPage() {
  const { plan, update } = usePlan();
  const types = enabledRevenueTypes(plan);
  const quotaTypes = types.filter((t) => t.quotaBased);
  const flatTypes = types.filter((t) => !t.quotaBased);
  const symbol = currencySymbol(plan.currency);
  const ruleFor = (rt: RevenueType) => plan.rules.find((r) => r.revenueTypeId === rt.id);
  const f = plan.features;

  return (
    <div className="space-y-5">
      <PageHeader title="Commission rules" description="Each revenue type has its own rate, accelerators, threshold and cap." />

      <Card title="Rule options" description="Turn on only what your plan needs; details appear when enabled.">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field group label="Configuration mode">
            <Segmented<ConfigMode>
              value={plan.configMode}
              onChange={(configMode) => update((p) => ({ ...p, configMode }))}
              options={[
                { value: "simple", label: "Simple" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
          </Field>
          {plan.configMode === "simple" ? (
            <Switch
              checked={f.accelerators}
              onChange={(v) => update((p) => setFeature(p, "accelerators", v))}
              label="Enable accelerators"
              description="Higher rate above quota."
            />
          ) : (
            <div className="text-xs text-slate-500">Advanced mode: accelerators are defined by the tiers.</div>
          )}
          <Switch
            checked={f.threshold}
            onChange={(v) => update((p) => setFeature(p, "threshold", v))}
            label="Enable threshold"
            description={
              plan.configMode === "advanced"
                ? "Advanced tiers are paid at their own rate. Use a 0% tier for a band that pays nothing."
                : f.threshold
                  ? `No commission below ${quotaTypes.map((rt) => ruleFor(rt)?.thresholdPct).find((n) => n !== undefined) ?? 0}% attainment.`
                  : "Minimum attainment before commission starts."
            }
          />
          <Switch
            checked={f.caps}
            onChange={(v) => update((p) => setFeature(p, "caps", v))}
            label="Enable caps"
            description="Max payout or max attainment counted."
          />
        </div>
        {f.caps && (
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <Field label="Maximum total commission" hint="Across all modeled periods. Empty = uncapped.">
              <NumberInput
                prefix={symbol}
                allowNull
                min={0}
                value={plan.cap.maxTotalPayout}
                onChange={(v) => update((p) => ({ ...p, cap: { maxTotalPayout: v } }))}
              />
            </Field>
          </div>
        )}
      </Card>

      {types.length === 0 && <EmptyState>No revenue types enabled.</EmptyState>}

      {quotaTypes.map((rt) => {
        const rule = ruleFor(rt);
        return rule ? <QuotaRuleCard key={rt.id} rt={rt} rule={rule} /> : null;
      })}

      {flatTypes.length > 0 && (
        <Card title="Flat-rate revenue" description="Paid on credited revenue without quota attainment, separate from the main quota structure." bodyClassName="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Revenue type</Th>
                <Th align="right">Commission rate</Th>
                <Th>Conditions</Th>
                {f.caps && <Th align="right">Max payout per period</Th>}
              </tr>
            </thead>
            <tbody>
              {flatTypes.map((rt) => {
                const rule = ruleFor(rt);
                if (!rule) return null;
                const patch = (p: Partial<CommissionRule>) => update((pl) => updateRule(pl, rule.id, p));
                return (
                  <tr key={rt.id}>
                    <Td className="font-medium text-slate-700">{rt.label}</Td>
                    <Td align="right" className="w-36">
                      <NumberInput suffix="%" min={0} value={rule.baseRate} onChange={(v) => patch({ baseRate: v ?? 0 })} />
                    </Td>
                    <Td>
                      <Checkbox
                        checked={rule.requireInPeriod}
                        onChange={(requireInPeriod) => patch({ requireInPeriod })}
                        label={rt.key === "renewal" ? "Renewal must happen within the period" : "Only revenue within the period"}
                      />
                    </Td>
                    {f.caps && (
                      <Td align="right" className="w-44">
                        <NumberInput prefix={symbol} allowNull min={0} value={rule.maxPayoutPerPeriod} onChange={(v) => patch({ maxPayoutPerPeriod: v })} />
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          {flatTypes.some((rt) => ruleFor(rt)?.requireInPeriod) && (
            <div className="p-4">
              <Alert>Enter out-of-period amounts in the &quot;Excluded&quot; column on the Quota &amp; performance page.</Alert>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
