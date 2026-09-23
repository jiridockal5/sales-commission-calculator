"use client";

import Link from "next/link";
import { useCalculation, useMoney } from "@/hooks/useCalculation";
import type { CommissionPlan } from "@/lib/commission-engine/types";
import { formatPct } from "@/lib/format/currency";

/** Compact live results shown above configuration pages. */
export function SummaryStrip({ plan }: { plan: CommissionPlan }) {
  const result = useCalculation(plan);
  const { fmt0 } = useMoney(plan.currency);
  const t = result.totals;
  const items = [
    { label: "Quota", value: fmt0(t.quota) },
    { label: "Actual", value: fmt0(t.actual) },
    { label: "Attainment", value: formatPct(t.attainmentPct) },
    { label: "Variable earned", value: fmt0(t.earnedVariable), strong: true },
    { label: "Effective rate", value: formatPct(t.effectiveRatePct, 2) },
    { label: "Total comp cost", value: fmt0(result.employerCost.totalCost) },
  ];
  return (
    <div className="no-print border-b border-slate-200 bg-white">
      <div className="flex items-center gap-x-6 gap-y-1 overflow-x-auto px-4 py-2 sm:px-6">
        {items.map((i) => (
          <div key={i.label} className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{i.label}</span>
            <span className={i.strong ? "num text-sm font-semibold text-brand-700" : "num text-sm font-medium text-slate-800"}>{i.value}</span>
          </div>
        ))}
        <Link href="/results" className="ml-auto shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700">
          View results
        </Link>
      </div>
    </div>
  );
}
