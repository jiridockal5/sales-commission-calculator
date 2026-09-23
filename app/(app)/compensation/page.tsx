"use client";

import { Field, NumberInput } from "@/components/ui/controls";
import { Card, KpiCard, PageHeader } from "@/components/ui/layout";
import { EmployerCostTable, OTEScenarioTable } from "@/components/results/ResultTables";
import { useCalculation, useMoney, useOTE } from "@/hooks/useCalculation";
import { usePlan } from "@/hooks/usePlan";
import { currencySymbol, formatPct } from "@/lib/format/currency";

export default function CompensationPage() {
  const { plan, update } = usePlan();
  const result = useCalculation(plan);
  const ote = useOTE(plan);
  const { fmt0 } = useMoney(plan.currency);
  const symbol = currencySymbol(plan.currency);
  const setOte = (patch: Partial<typeof plan.ote>) => update((p) => ({ ...p, ote: { ...p.ote, ...patch } }));
  const scope = plan.mode === "single" && plan.calculationPeriod !== "annual" ? "the selected period (pro-rated)" : "the modeled periods";

  return (
    <div className="space-y-5">
      <PageHeader title="Compensation" description="On-target earnings and the company's total cost of the plan." />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="On-target earnings (annual)" className="lg:col-span-1">
          <div className="space-y-4">
            <Field label="Base salary">
              <NumberInput prefix={symbol} min={0} value={plan.ote.baseSalary} onChange={(v) => setOte({ baseSalary: v ?? 0 })} />
            </Field>
            <Field label="Target variable compensation" hint="Variable pay at 100% attainment.">
              <NumberInput prefix={symbol} min={0} value={plan.ote.targetVariable} onChange={(v) => setOte({ targetVariable: v ?? 0 })} />
            </Field>
            <Field label="Employer overhead" hint="Payroll taxes and benefits on cash compensation.">
              <NumberInput suffix="%" min={0} value={plan.ote.employerOverheadPct} onChange={(v) => setOte({ employerOverheadPct: v ?? 0 })} />
            </Field>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <div className="text-xs text-slate-500">OTE</div>
                <div className="num text-lg font-semibold text-slate-900">{fmt0(ote.ote)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pay mix (base / variable)</div>
                <div className="num text-lg font-semibold text-slate-900">
                  {ote.variablePct === null ? "–" : `${Math.round(100 - ote.variablePct)} / ${Math.round(ote.variablePct)}`}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Variable earned" value={fmt0(result.totals.earnedVariable)} sub={`Target ${fmt0(result.totals.targetVariable)}`} emphasis />
            <KpiCard label="Variable attainment" value={formatPct(result.totals.variableAttainmentPct)} sub="Of target variable" />
            <KpiCard label="OTE attainment" value={formatPct(result.totals.oteAttainmentPct)} sub={`Base + variable vs OTE`} />
          </div>
          <Card title="Commission at attainment levels" description={`Commission + bonuses if every quota-based revenue type hit the given attainment, for ${scope}.`} bodyClassName="p-0">
            <OTEScenarioTable plan={plan} ote={ote} />
          </Card>
        </div>
      </div>

      <Card title="Employer cost" description={`Total sales compensation cost for ${scope}.`} bodyClassName="p-0">
        <EmployerCostTable plan={plan} result={result} />
      </Card>
    </div>
  );
}
