"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { PayoutCurveChart } from "@/components/charts/PayoutCurveChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { KpiGrid } from "@/components/results/KpiGrid";
import {
  EmployerCostTable,
  OTEScenarioTable,
  PayoutScheduleTable,
  PeriodBreakdownTable,
  RevenueTypeBreakdownTable,
  SplitTable,
} from "@/components/results/ResultTables";
import { Button } from "@/components/ui/controls";
import { Card } from "@/components/ui/layout";
import { useCalculation, useOTE, usePayoutCurve } from "@/hooks/useCalculation";
import { PERIOD_TYPE_LABELS } from "@/lib/commission-engine/periods";
import { resolveTiers, tierLabel } from "@/lib/commission-engine/tiers";
import type { CommissionPlan } from "@/lib/commission-engine/types";
import { enabledRevenueTypes } from "@/lib/plan/planOperations";
import { useActivePlan, usePlanStore } from "@/store/planStore";

function PlanSummary({ plan }: { plan: CommissionPlan }) {
  const f = plan.features;
  const enabledFeatures = (Object.keys(f) as (keyof typeof f)[]).filter((k) => f[k]);
  const items: [string, string][] = [
    ["Calculation period", `${PERIOD_TYPE_LABELS[plan.calculationPeriod]} (${plan.mode === "single" ? "single period" : "full year"})`],
    ["Payout frequency", PERIOD_TYPE_LABELS[plan.payoutFrequency]],
    ["Configuration", plan.configMode === "simple" ? "Simple" : "Advanced tiers"],
    ["Currency", plan.currency],
    ["Enabled features", enabledFeatures.length ? enabledFeatures.join(", ") : "None"],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {items.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1.5 text-xs">
        {enabledRevenueTypes(plan).map((rt) => {
          const rule = plan.rules.find((r) => r.revenueTypeId === rt.id);
          if (!rule) return null;
          const desc = rt.quotaBased
            ? resolveTiers(rule, plan.configMode, f.accelerators)
                .map((t) => `${tierLabel(t)} → ${t.rate}%`)
                .join(", ") + ` (${rule.accelerationMethod})`
            : `Flat ${rule.baseRate}%`;
          return (
            <div key={rt.id}>
              <span className="font-medium text-slate-800">{rt.label}:</span> <span className="text-slate-600">{desc}</span>
              {f.threshold && rt.quotaBased && rule.thresholdPct > 0 && <span className="text-slate-600">; threshold {rule.thresholdPct}%</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Report({ plan }: { plan: CommissionPlan }) {
  const result = useCalculation(plan);
  const curve = usePayoutCurve(plan);
  const ote = useOTE(plan);
  const printed = useRef(false);

  useEffect(() => {
    if (printed.current) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex items-center justify-between">
        <Link href="/results" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to results
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
        </Button>
      </div>

      <header className="border-b border-slate-200 pb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Sales commission plan report</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{plan.name}</h1>
        {plan.description && <p className="mt-1 text-sm text-slate-600">{plan.description}</p>}
        <p className="mt-1 text-xs text-slate-400">Generated {new Date().toLocaleString()}</p>
      </header>

      <Card title="Plan configuration">
        <PlanSummary plan={plan} />
      </Card>

      <KpiGrid plan={plan} result={result} />

      <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
        <Card title="Payout curve">
          <PayoutCurveChart
            data={curve.map((p) => ({ attainmentPct: p.attainmentPct, payout: p.payout }))}
            series={[{ key: "payout", name: "Variable pay" }]}
            currency={plan.currency}
            currentAttainment={result.totals.attainmentPct}
            height={240}
          />
        </Card>
        <Card title="Performance">
          <PerformanceChart periods={result.periods} currency={plan.currency} height={240} />
        </Card>
      </div>

      <Card title="Breakdown by period" bodyClassName="p-0">
        <PeriodBreakdownTable plan={plan} result={result} />
      </Card>
      <Card title="Breakdown by revenue type" bodyClassName="p-0">
        <RevenueTypeBreakdownTable plan={plan} result={result} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
        <Card title="Commission at attainment levels" bodyClassName="p-0">
          <OTEScenarioTable plan={plan} ote={ote} />
        </Card>
        <Card title="Employer cost" bodyClassName="p-0">
          <EmployerCostTable plan={plan} result={result} />
        </Card>
        <Card title="Payout schedule" bodyClassName="p-0">
          <PayoutScheduleTable plan={plan} result={result} />
        </Card>
        {result.splits && (
          <Card title="Split commission" bodyClassName="p-0">
            <SplitTable plan={plan} result={result} />
          </Card>
        )}
      </div>

      {result.warnings.length > 0 && (
        <Card title="Notes">
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function ReportPage() {
  const hydrated = usePlanStore((s) => s.hydrated);
  const hydrate = usePlanStore((s) => s.hydrate);
  const plan = useActivePlan();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (!hydrated || !plan) return <div className="p-10 text-center text-sm text-slate-400">Loading report…</div>;
  return <Report plan={plan} />;
}
