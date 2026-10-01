"use client";

import { useMemo } from "react";
import { useMoney } from "@/hooks/useCalculation";
import { explainCalculation, type CommissionSliceExplanation, type PeriodExplanation, type RevenueTypeExplanation } from "@/lib/commission-engine/explainCalculation";
import type { CalculationResult, CommissionPlan } from "@/lib/commission-engine/types";
import { formatPct } from "@/lib/format/currency";

function formatRate(value: number): string {
  const tenths = Math.abs(value * 10 - Math.round(value * 10)) < 1e-6;
  const digits = Number.isInteger(value) ? 0 : tenths ? 1 : 2;
  return formatPct(value, digits);
}

function Equation({ parts }: { parts: string[] }) {
  return (
    <p className="num min-w-0 text-sm font-medium leading-6 text-slate-900">
      {parts.map((part, index) =>
        index % 2 === 0 ? (
          <span key={index} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="num whitespace-nowrap font-semibold text-slate-900">{value}</dd>
      {hint && <dd className="w-full text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

function periodBaseText(period: PeriodExplanation, base: string): string {
  const name = `${period.periodTypeLabel.toLowerCase()} period (${period.label})`;
  if (period.periodType === "annual") return `This ${name} is the full year, so base is ${base}.`;
  return `This ${name} is ${period.yearFractionLabel} of the year, so base is ${base}.`;
}

function methodText(method: RevenueTypeExplanation["method"]): string {
  if (method === "retroactive") return "Retroactive: the rate of the band reached applies to all credited revenue.";
  if (method === "flat") return "Flat rate on credited revenue.";
  return "Marginal: each band is paid only on the revenue inside it.";
}

function quotaHint(plan: CommissionPlan): string {
  if (plan.mode === "multi") return "Annual target variable ÷ annual quota. Modeled periods are summed, not multiplied again.";
  if (plan.calculationPeriod === "monthly") return "Annual target variable ÷ annual quota. This month's quota counts as × 12.";
  if (plan.calculationPeriod === "quarterly") return "Annual target variable ÷ annual quota. This quarter's quota counts as × 4.";
  if (plan.calculationPeriod === "half_year") return "Annual target variable ÷ annual quota. This half-year's quota counts as × 2.";
  return "Annual target variable ÷ annual quota.";
}

function variableHint(period: PeriodExplanation): string {
  const plain =
    period.bonusTotal === 0 &&
    period.guaranteeTopUp === 0 &&
    period.clawback === 0 &&
    period.planCapReduction === 0 &&
    period.variableEarned === period.commission;
  if (plain) return "Commission only.";
  return "Base is not included. Adjustments on this period are included.";
}

function SliceLine({ slice, money }: { slice: CommissionSliceExplanation; money: (value: number) => string }) {
  const rate = formatRate(slice.rate);
  if (slice.acceleratorBand) {
    return (
      <p className="min-w-0 text-sm leading-6 text-slate-700">
        <span className="text-xs text-slate-500">
          {slice.label} at {rate}
        </span>
        <span className="text-slate-300"> · </span>
        Nothing above the {formatRate(slice.fromPct)} accelerator line = <span className="num whitespace-nowrap">{money(0)}</span>
      </p>
    );
  }
  if (slice.empty) {
    return (
      <p className="min-w-0 text-sm leading-6 text-slate-700">
        <span className="text-xs text-slate-500">
          {slice.label} at {rate}
        </span>
        <span className="text-slate-300"> · </span>
        Nothing in this band = <span className="num whitespace-nowrap">{money(0)}</span>
      </p>
    );
  }
  const revenue = slice.appliesToAll ? `All ${money(slice.revenue)}` : money(slice.revenue);
  return (
    <p className="num min-w-0 text-sm leading-6 text-slate-800">
      <span className="text-xs text-slate-500">{slice.label}</span>
      <span className="text-slate-300"> · </span>
      <span className="whitespace-nowrap">
        {revenue} at {rate}
      </span>
      {" = "}
      <span className="whitespace-nowrap font-medium text-slate-900">{money(slice.commission)}</span>
    </p>
  );
}

function TypeSteps({
  type,
  showLabel,
  plan,
  money,
}: {
  type: RevenueTypeExplanation;
  showLabel: boolean;
  plan: CommissionPlan;
  money: (value: number) => string;
}) {
  const weighted = plan.features.team && type.quotaBased && type.commission !== type.grossCommission && type.capReduction === 0;
  return (
    <div className="min-w-0 space-y-1.5">
      {showLabel && <div className="text-xs font-medium text-slate-700">{type.label}</div>}
      {!type.belowThreshold && (
        <p className={showLabel ? "text-xs text-slate-500" : "text-xs font-medium text-slate-700"}>{methodText(type.method)}</p>
      )}
      {showLabel && (
        <p className="num min-w-0 text-xs leading-5 text-slate-500">
          <span className="whitespace-nowrap">Quota {money(type.quota)}</span>
          {" · "}
          <span className="whitespace-nowrap">Actual {money(type.actual)}</span>
          {" · "}
          <span className="whitespace-nowrap">Attainment {formatPct(type.attainmentPct)}</span>
        </p>
      )}
      {type.commissionable !== type.actual && (
        <p className="text-xs text-slate-500">
          Commission uses <span className="num whitespace-nowrap">{money(type.commissionable)}</span> of{" "}
          <span className="num whitespace-nowrap">{money(type.actual)}</span> actual.
        </p>
      )}
      {type.belowThreshold ? (
        <p className="min-w-0 text-sm leading-6 text-slate-800">
          Commission is {money(0)} because attainment ({formatPct(type.attainmentPct)}) is below the{" "}
          {type.thresholdPct === null ? "threshold" : formatRate(type.thresholdPct)} threshold.
        </p>
      ) : (
        <div className="min-w-0 space-y-1">
          {type.slices.map((slice) => (
            <SliceLine key={slice.tierId} slice={slice} money={money} />
          ))}
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 pt-1 text-sm">
            <span className="text-slate-500">Commission</span>
            <span className="num whitespace-nowrap font-semibold text-brand-700">{money(type.commission)}</span>
          </div>
          {type.capReduction > 0 && (
            <p className="text-xs text-slate-500">
              Cap reduces <span className="num whitespace-nowrap">{money(type.grossCommission)}</span> by{" "}
              <span className="num whitespace-nowrap">{money(type.capReduction)}</span>.
            </p>
          )}
          {weighted && (
            <p className="text-xs text-slate-500">
              Individual weight {formatRate(plan.team.individualWeight)} brings the bands to{" "}
              <span className="num whitespace-nowrap">{money(type.commission)}</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CalculationBreakdown({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const explained = useMemo(() => explainCalculation(plan, result), [plan, result]);
  const { fmt0 } = useMoney(plan.currency);
  const several = explained.periods.length > 1;

  return (
    <div className="min-w-0 space-y-4 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">How this is calculated</h3>

      <div className="min-w-0">
        <div className="text-xs text-slate-500">Annual base + annual target variable = OTE</div>
        <Equation parts={[fmt0(explained.annualBase), " + ", fmt0(explained.annualTargetVariable), " = ", fmt0(explained.annualOte)]} />
      </div>

      {explained.periods.length === 0 && <p className="text-sm text-slate-500">No periods to calculate.</p>}

      {explained.periods.map((period) => (
        <div key={period.periodId} className="min-w-0 space-y-3">
          {several && <h4 className="text-sm font-semibold text-slate-900">{period.label}</h4>}
          <p className="min-w-0 text-sm leading-6 text-slate-700">{periodBaseText(period, fmt0(period.baseSalary))}</p>
          <p className="num min-w-0 text-sm leading-6 text-slate-800">
            <span className="whitespace-nowrap">Quota {fmt0(period.quota)}</span>
            {" · "}
            <span className="whitespace-nowrap">Actual {fmt0(period.actual)}</span>
            {" · "}
            <span className="whitespace-nowrap">Attainment {formatPct(period.attainmentPct)}</span>
          </p>
          {period.revenueTypes.map((type) => (
            <TypeSteps key={type.revenueTypeId} type={type} showLabel={period.revenueTypes.length > 1} plan={plan} money={fmt0} />
          ))}
          <dl className="min-w-0 space-y-1.5 border-t border-slate-100 pt-3">
            <Line label="Variable earned" value={fmt0(period.variableEarned)} hint={variableHint(period)} />
            <Line label="Period base" value={fmt0(period.baseSalary)} />
            <Line label="Total cash" value={fmt0(period.totalCash)} hint="Base + variable earned." />
          </dl>
        </div>
      ))}

      <div className="min-w-0 border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-500">Rate at 100% of quota</div>
        {explained.annualQuota === null || explained.rateAtQuotaPct === null ? (
          <p className="mt-0.5 text-sm text-slate-700">Annual quota is not set, so the rate at 100% of quota cannot be shown.</p>
        ) : (
          <>
            <Equation
              parts={[fmt0(explained.annualTargetVariable), " / ", fmt0(explained.annualQuota), " = ", formatRate(explained.rateAtQuotaPct)]}
            />
            <p className="text-xs text-slate-500">{quotaHint(plan)}</p>
          </>
        )}
      </div>
    </div>
  );
}
