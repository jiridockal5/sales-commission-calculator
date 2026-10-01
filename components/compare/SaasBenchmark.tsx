"use client";

import { Fragment } from "react";
import { Field, NumberInput, Segmented } from "@/components/ui/controls";
import { Card, DataTable, Td, Th } from "@/components/ui/layout";
import { useBenchmarkPrefs } from "@/hooks/useBenchmarkPrefs";
import {
  ASP_BANDS,
  BENCHMARK_SOURCE,
  benchmarkFigures,
  userPlanBenchmark,
  type AspBandId,
  type PayMix,
} from "@/lib/benchmarks/saasAeBenchmark";
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

export function SaasBenchmark({ plans }: { plans: CommissionPlan[] }) {
  const { prefs, setBand, setFxRate } = useBenchmarkPrefs();
  if (plans.length === 0 || !prefs) return null;

  const fxCurrencies = CURRENCIES.map((c) => c.code).filter((code): code is FxCurrency => code !== "USD" && plans.some((plan) => plan.currency === code));
  const missingFx = fxCurrencies.filter((code) => prefs.fx[code] === undefined);

  const rows = plans.map((plan) => ({
    plan,
    user: userPlanBenchmark(plan),
    benchmark: benchmarkFigures(prefs.band, plan.currency, plan.currency === "USD" ? null : (prefs.fx[plan.currency] ?? null)),
  }));

  return (
    <>
      <Card title="SaaS AE benchmark" description={BENCHMARK_SOURCE}>
        <div className="flex min-w-0 flex-col gap-4">
          <Field group label="Deal size" hint="ASP bands are in USD. The middle band is the typical SaaS cohort." className="min-w-0">
            <Segmented<AspBandId>
              value={prefs.band}
              onChange={setBand}
              options={ASP_BANDS.map((band) => ({ value: band.id, label: `${band.label} · ${band.aspLabel}` }))}
            />
          </Field>
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

      <Card title="Benchmark comparison" description="Five survey rows beside each plan. Your plan figures stay as entered." bodyClassName="p-0">
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
                },
                {
                  label: "Pay mix",
                  hint: "Base / variable",
                  your: (row: (typeof rows)[number]) => formatPayMix(row.user.payMix),
                  bench: (row: (typeof rows)[number]) => formatPayMix(row.benchmark.payMix),
                },
                {
                  label: "Annual quota",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatMoney(row.user.annualQuota, row.plan.currency),
                  bench: (row: (typeof rows)[number]) => formatMoney(row.benchmark.annualQuota, row.plan.currency),
                },
                {
                  label: "Quota / OTE",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatRatio(row.user.quotaToOte),
                  bench: (row: (typeof rows)[number]) => formatRatio(row.benchmark.quotaToOte),
                },
                {
                  label: "Rate at 100% of quota",
                  hint: null,
                  your: (row: (typeof rows)[number]) => formatRate(row.user.rateAtQuotaPct),
                  bench: (row: (typeof rows)[number]) => formatRate(row.benchmark.rateAtQuotaPct),
                },
              ] as const
            ).map((metric) => (
              <tr key={metric.label}>
                <Td className="font-medium text-slate-700">
                  <div>{metric.label}</div>
                  {metric.hint && <div className="text-[11px] font-normal text-slate-400">{metric.hint}</div>}
                </Td>
                {rows.map((row) => (
                  <Fragment key={row.plan.id}>
                    <Td align="right">{metric.your(row)}</Td>
                    <Td align="right" className="text-slate-600">
                      {metric.bench(row)}
                    </Td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </>
  );
}
