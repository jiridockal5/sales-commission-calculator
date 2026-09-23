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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3 lg:flex lg:items-center lg:gap-x-6 lg:gap-y-1 lg:overflow-x-auto lg:px-6 lg:py-2">
        {items.map((i) => (
          <div key={i.label} className="flex min-w-0 flex-col gap-0.5 lg:shrink-0 lg:flex-row lg:items-baseline lg:gap-1.5">
            <span className="text-xs font-medium text-slate-500 lg:text-[11px] lg:uppercase lg:tracking-wide lg:text-slate-400">{i.label}</span>
            <span
              className={
                i.strong
                  ? "num text-base font-semibold text-brand-700 lg:text-sm"
                  : "num text-base font-semibold text-slate-900 lg:text-sm lg:font-medium lg:text-slate-800"
              }
            >
              {i.value}
            </span>
          </div>
        ))}
        <Link
          href="/results"
          className="col-span-full inline-flex min-h-11 items-center text-sm font-medium text-brand-600 hover:text-brand-700 lg:ml-auto lg:min-h-0 lg:text-xs"
        >
          View results
        </Link>
      </div>
    </div>
  );
}
