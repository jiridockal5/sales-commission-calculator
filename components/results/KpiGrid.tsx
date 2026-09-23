"use client";

import { KpiCard } from "@/components/ui/layout";
import { useMoney } from "@/hooks/useCalculation";
import type { CalculationResult, CommissionPlan } from "@/lib/commission-engine/types";
import { formatPct } from "@/lib/format/currency";

export function KpiGrid({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt0 } = useMoney(plan.currency);
  const t = result.totals;
  const quotaSub = t.fullQuota !== t.quota ? `Full quota ${fmt0(t.fullQuota)} (ramped)` : plan.mode === "multi" ? "All periods" : undefined;
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <KpiCard label="Quota" value={fmt0(t.quota)} sub={quotaSub} />
      <KpiCard label="Actual performance" value={fmt0(t.actual)} sub={`Commissionable ${fmt0(t.commissionableRevenue)}`} />
      <KpiCard label="Quota attainment" value={formatPct(t.attainmentPct)} sub="Quota-based revenue" />
      <KpiCard
        label="Total commission"
        value={fmt0(t.earnedVariable)}
        sub={t.bonuses || t.guarantee || t.clawbacks ? `Commission ${fmt0(t.commission)} + adj.` : "Net variable earned"}
        emphasis
      />
      <KpiCard label="OTE attainment" value={formatPct(t.oteAttainmentPct)} sub={`Variable ${formatPct(t.variableAttainmentPct)} of target`} />
      <KpiCard label="Effective commission rate" value={formatPct(t.effectiveRatePct, 2)} sub="Commission ÷ commissionable revenue" />
      <KpiCard label="Total compensation cost" value={fmt0(result.employerCost.totalCost)} sub={`Base ${fmt0(t.baseSalary)}`} />
    </div>
  );
}
