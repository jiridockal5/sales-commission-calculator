"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { PayoutCurveChart, SERIES_COLORS } from "@/components/charts/PayoutCurveChart";
import { Button, Checkbox } from "@/components/ui/controls";
import { Alert, Card, DataTable, EmptyState, PageHeader, Td, Th } from "@/components/ui/layout";
import { calculatePlanComparison } from "@/lib/commission-engine/calculatePlanComparison";
import type { PlanComparisonEntry } from "@/lib/commission-engine/types";
import { formatCurrency, formatPct } from "@/lib/format/currency";
import { clonePlanWithNewIds } from "@/lib/plan/planFactory";
import { aggressiveVariant, retroactiveVariant } from "@/lib/plan/planOperations";
import { useActivePlan, usePlanStore } from "@/store/planStore";

type Metric = {
  label: string;
  value: (e: PlanComparisonEntry) => number | null;
  kind: "money" | "pct";
  /** Whether a higher value is better for the company (drives delta coloring). */
  higherIsCostly?: boolean;
};

const METRICS: Metric[] = [
  { label: "Total commission (net variable)", value: (e) => e.totalCommission, kind: "money", higherIsCostly: true },
  { label: "Total compensation", value: (e) => e.totalCompensation, kind: "money", higherIsCostly: true },
  { label: "Employer cost", value: (e) => e.employerCost, kind: "money", higherIsCostly: true },
  { label: "Effective commission rate", value: (e) => e.effectiveRatePct, kind: "pct", higherIsCostly: true },
  { label: "Commission as % of revenue", value: (e) => e.commissionPctOfRevenue, kind: "pct", higherIsCostly: true },
  { label: "Quota attainment", value: (e) => e.attainmentPct, kind: "pct" },
];

export default function ComparePage() {
  const plans = usePlanStore((s) => s.plans);
  const compareIds = usePlanStore((s) => s.compareIds);
  const setCompareIds = usePlanStore((s) => s.setCompareIds);
  const addPlansForComparison = usePlanStore((s) => s.addPlansForComparison);
  const activePlan = useActivePlan();
  const selected = useMemo(() => plans.filter((p) => compareIds.includes(p.id)), [plans, compareIds]);
  const comparison = useMemo(() => calculatePlanComparison(selected), [selected]);
  const entries = comparison.entries;
  const baseline = entries[0];
  const mixedCurrencies = new Set(entries.map((e) => e.currency)).size > 1;

  const fmtValue = (e: PlanComparisonEntry, v: number | null, kind: Metric["kind"]) =>
    kind === "money" ? formatCurrency(v, e.currency, { decimals: false }) : formatPct(v, kind === "pct" ? 2 : 1);

  const series = entries.map((e, i) => ({ key: e.planId, name: e.planName, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const currency = baseline?.currency ?? "USD";

  const periodData = comparison.periodLabels.map((label) => {
    const row: Record<string, string | number> = { label };
    for (const e of entries) row[e.planId] = e.byPeriod.find((p) => p.label === label)?.amount ?? 0;
    return row;
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Compare plans" description="Evaluate commission plan structures side by side. Each plan is calculated with its own quotas and actuals." />

      <Card title="Plans to compare">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {plans.map((p) => (
            <Checkbox
              key={p.id}
              checked={compareIds.includes(p.id)}
              onChange={(checked) => setCompareIds(checked ? [...compareIds, p.id] : compareIds.filter((id) => id !== p.id))}
              label={p.name}
            />
          ))}
        </div>
        {plans.length < 2 && activePlan && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Alert>Duplicate the current plan and change its rules to compare structures, or generate example variants.</Alert>
            <Button
              size="sm"
              onClick={() =>
                addPlansForComparison([
                  clonePlanWithNewIds(retroactiveVariant(activePlan)),
                  clonePlanWithNewIds(aggressiveVariant(activePlan)),
                ])
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              Create example variants
            </Button>
          </div>
        )}
      </Card>

      {entries.length === 0 ? (
        <EmptyState>Select at least one plan.</EmptyState>
      ) : (
        <>
          {mixedCurrencies && <Alert tone="warning">Selected plans use different currencies. Values are not converted.</Alert>}

          <Card title="Key metrics" description={entries.length > 1 ? `Differences are shown relative to ${baseline.planName}.` : undefined} bodyClassName="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Metric</Th>
                  {entries.map((e, i) => (
                    <Th key={e.planId} align="right">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        {e.planName}
                      </span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.label}>
                    <Td className="font-medium text-slate-700">{m.label}</Td>
                    {entries.map((e, i) => {
                      const v = m.value(e);
                      const base = m.value(baseline);
                      const delta = i > 0 && v !== null && base !== null ? v - base : null;
                      return (
                        <Td key={e.planId} align="right">
                          <div>{fmtValue(e, v, m.kind)}</div>
                          {delta !== null && Math.abs(delta) > 0.005 && (
                            <div className={`text-[11px] ${m.higherIsCostly ? (delta > 0 ? "text-red-600" : "text-emerald-700") : "text-slate-500"}`}>
                              {delta > 0 ? "+" : "−"}
                              {m.kind === "money" ? formatCurrency(Math.abs(delta), e.currency, { decimals: false }) : `${Math.abs(delta).toFixed(2)} pp`}
                            </div>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Card>

          <Card title="Payout curves" description="Variable pay at each quota attainment level for every selected plan.">
            <PayoutCurveChart data={comparison.payoutCurves} series={series} currency={currency} showLegend height={360} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Commission by period" bodyClassName="p-0">
              {periodData.length > 1 && (
                <div className="p-4">
                  <GroupedBarChart data={periodData} series={series} currency={currency} height={240} />
                </div>
              )}
              <DataTable>
                <thead>
                  <tr>
                    <Th>Period</Th>
                    {entries.map((e) => (
                      <Th key={e.planId} align="right">
                        {e.planName}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.periodLabels.map((label) => (
                    <tr key={label}>
                      <Td className="font-medium text-slate-700">{label}</Td>
                      {entries.map((e) => {
                        const item = e.byPeriod.find((p) => p.label === label);
                        return (
                          <Td key={e.planId} align="right">
                            {item ? formatCurrency(item.amount, e.currency, { decimals: false }) : "–"}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>

            <Card title="Commission by revenue type" bodyClassName="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Revenue type</Th>
                    {entries.map((e) => (
                      <Th key={e.planId} align="right">
                        {e.planName}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.revenueTypeLabels.map((label) => (
                    <tr key={label}>
                      <Td className="font-medium text-slate-700">{label}</Td>
                      {entries.map((e) => {
                        const item = e.byRevenueType.find((p) => p.label === label);
                        return (
                          <Td key={e.planId} align="right">
                            {item ? formatCurrency(item.amount, e.currency, { decimals: false }) : "–"}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
