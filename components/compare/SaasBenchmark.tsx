"use client";

import { Fragment } from "react";
import { Field, NumberInput } from "@/components/ui/controls";
import { Card, DataTable, Td, Th } from "@/components/ui/layout";
import { useBenchmarkPrefs } from "@/hooks/useBenchmarkPrefs";
import {
  BENCHMARK_SOURCE,
  DEFAULT_ASP_BAND,
  benchmarkFigures,
  pointGap,
  relativeGapPct,
  userPlanBenchmark,
  type PayMix,
} from "@/lib/benchmarks/saasAeBenchmark";
import { dec } from "@/lib/commission-engine/money";
import type { CommissionPlan, CurrencyCode } from "@/lib/commission-engine/types";
import { CURRENCIES, formatCurrency, formatPct } from "@/lib/format/currency";
import type { FxCurrency } from "@/lib/persistence/benchmarkPrefs";

function formatMoney(value: number | null, currency: CurrencyCode): string {
  if (value === null || !Number.isFinite(value)) return "–";
  const whole = Math.abs(value - Math.round(value)) < 0.001;
  return formatCurrency(value, currency, { decimals: !whole });
}

function formatPayMix(mix: PayMix | null): string {
  if (!mix) return "–";
  const part = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${part(mix.basePct)} / ${part(mix.variablePct)}`;
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return formatPct(value, Number.isInteger(value) ? 0 : 2);
}

/** Signed gap. Whole numbers have no decimal; other gaps use one. Null when the gap rounds to 0. */
function formatGapMagnitude(value: number): string | null {
  const digits = Number.isInteger(value) ? 0 : 1;
  const rounded = dec(value).abs().toDecimalPlaces(digits);
  if (rounded.isZero()) return null;
  const text = rounded.toNumber().toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${value > 0 ? "+" : "−"}${text}`;
}

function formatRelativeGap(user: number | null, benchmark: number | null): string | null {
  const gap = relativeGapPct(user, benchmark);
  if (gap === null) return null;
  const body = formatGapMagnitude(gap);
  return body === null ? null : `${body}%`;
}

function formatPointGap(user: number | null, benchmark: number | null): string | null {
  const gap = pointGap(user, benchmark);
  if (gap === null) return null;
  const body = formatGapMagnitude(gap);
  return body === null ? null : `${body} pp`;
}

function formatPayMixGap(user: PayMix | null, benchmark: PayMix): string | null {
  if (!user) return null;
  const base = pointGap(user.basePct, benchmark.basePct);
  const variable = pointGap(user.variablePct, benchmark.variablePct);
  if (base === null || variable === null) return null;
  const baseBody = formatGapMagnitude(base);
  const variableBody = formatGapMagnitude(variable);
  if (baseBody === null && variableBody === null) return null;
  return `${baseBody ?? "0"} / ${variableBody ?? "0"} pp`;
}

export function SaasBenchmark({ plans }: { plans: CommissionPlan[] }) {
  const { prefs, setFxRate } = useBenchmarkPrefs();
  if (plans.length === 0 || !prefs) return null;

  const fxCurrencies = CURRENCIES.map((c) => c.code).filter((code): code is FxCurrency => code !== "USD" && plans.some((plan) => plan.currency === code));
  const missingFx = fxCurrencies.filter((code) => prefs.fx[code] === undefined);

  const rows = plans.map((plan) => ({
    plan,
    user: userPlanBenchmark(plan),
    benchmark: benchmarkFigures(DEFAULT_ASP_BAND, plan.currency, plan.currency === "USD" ? null : (prefs.fx[plan.currency] ?? null)),
  }));

  return (
    <>
      <Card title="SaaS AE benchmark" description={BENCHMARK_SOURCE}>
        <div className="flex min-w-0 flex-col gap-4">
          {fxCurrencies.length > 0 && (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fxCurrencies.map((code) => (
                <Field key={code} label="1 USD =" hint={`Benchmark OTE and quota in ${code}. Ratios are not converted.`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <NumberInput
                      className="min-w-0 flex-1"
                      allowNull
                      commitOnBlur
                      min={0}
                      placeholder="…"
                      ariaLabel={`1 USD in ${code}`}
                      value={prefs.fx[code] ?? null}
                      onChange={(value) => setFxRate(code, value)}
                    />
                    <span className="shrink-0 text-sm text-slate-500">{code}</span>
                  </div>
                </Field>
              ))}
            </div>
          )}
          {missingFx.length > 0 && (
            <p className="min-w-0 text-xs text-slate-500">
              Benchmark OTE and quota stay hidden in {missingFx.join(", ")} until you enter how many units equal 1 USD. Pay mix, quota / OTE, and the rate stay visible.
            </p>
          )}
          <p className="text-xs text-slate-500">Preview only. These medians are not saved into your plan.</p>
        </div>
      </Card>

      <Card title="Benchmark comparison" description="Five survey rows beside each plan. Your plan figures stay as entered. The small figure under your plan is the gap versus the survey median." bodyClassName="p-0">
        <DataTable>
          <thead>
            <tr>
              <Th />
              {rows.map(({ plan }) => (
                <Th key={plan.id} colSpan={2} align="center">
                  {plan.name}
                </Th>
              ))}
            </tr>
            <tr>
              <Th>Metric</Th>
              {rows.map(({ plan }) => (
                <Fragment key={plan.id}>
                  <Th align="right">Your plan</Th>
                  <Th align="right" className="text-brand-700">
                    Benchmark
                  </Th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                {
                  label: "Annual OTE",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatMoney(row.user.annualOte, row.plan.currency),
                  bench: (row: (typeof rows)[number]) => formatMoney(row.benchmark.annualOte, row.plan.currency),
                  gap: (row: (typeof rows)[number]) => formatRelativeGap(row.user.annualOte, row.benchmark.annualOte),
                },
                {
                  label: "Pay mix",
                  hint: "Base / variable",
                  your: (row: (typeof rows)[number]) => formatPayMix(row.user.payMix),
                  bench: (row: (typeof rows)[number]) => formatPayMix(row.benchmark.payMix),
                  gap: (row: (typeof rows)[number]) => formatPayMixGap(row.user.payMix, row.benchmark.payMix),
                },
                {
                  label: "Annual quota",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatMoney(row.user.annualQuota, row.plan.currency),
                  bench: (row: (typeof rows)[number]) => formatMoney(row.benchmark.annualQuota, row.plan.currency),
                  gap: (row: (typeof rows)[number]) => formatRelativeGap(row.user.annualQuota, row.benchmark.annualQuota),
                },
                {
                  label: "Quota / OTE",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatRatio(row.user.quotaToOte),
                  bench: (row: (typeof rows)[number]) => formatRatio(row.benchmark.quotaToOte),
                  gap: (row: (typeof rows)[number]) => formatRelativeGap(row.user.quotaToOte, row.benchmark.quotaToOte),
                },
                {
                  label: "Rate at 100% of quota",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatRate(row.user.rateAtQuotaPct),
                  bench: (row: (typeof rows)[number]) => formatRate(row.benchmark.rateAtQuotaPct),
                  gap: (row: (typeof rows)[number]) => formatPointGap(row.user.rateAtQuotaPct, row.benchmark.rateAtQuotaPct),
                },
              ] as const
            ).map((metric) => (
              <tr key={metric.label}>
                <Td className="font-medium text-slate-700">
                  <div>{metric.label}</div>
                  {metric.hint && <div className="text-[11px] font-normal text-slate-400">{metric.hint}</div>}
                </Td>
                {rows.map((row) => {
                  const gap = metric.gap(row);
                  return (
                    <Fragment key={row.plan.id}>
                      <Td align="right">
                        <div>{metric.your(row)}</div>
                        {gap && <div className="text-[11px] text-slate-500">{gap}</div>}
                      </Td>
                      <Td align="right" className="text-slate-600">
                        {metric.bench(row)}
                      </Td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </>
  );
}
