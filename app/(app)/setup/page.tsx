"use client";

import { ArrowRight, Eraser, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button, Field, Segmented, Select, TextInput } from "@/components/ui/controls";
import { Alert, Card, PageHeader } from "@/components/ui/layout";
import { usePlan } from "@/hooks/usePlan";
import { allowedPayoutFrequencies, PERIOD_TYPE_LABELS, periodLabel, periodCount } from "@/lib/commission-engine/periods";
import type { ConfigMode, CurrencyCode, PeriodType, PrimaryMetric } from "@/lib/commission-engine/types";
import { CURRENCIES } from "@/lib/format/currency";
import { changeCalculationPeriod } from "@/lib/plan/planOperations";
import { usePlanStore } from "@/store/planStore";

const PERIOD_OPTIONS = (Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((t) => ({ value: t, label: PERIOD_TYPE_LABELS[t] }));

const STEPS = [
  { href: "/revenue", title: "Revenue types", text: "Choose which metrics pay commission (New ARR, expansion, renewals…)." },
  { href: "/quota", title: "Quota & performance", text: "Enter quotas and aggregated actuals per period. Configure ramp and team quota." },
  { href: "/rules", title: "Commission rules", text: "Set rates, accelerators, thresholds and caps." },
  { href: "/advanced", title: "Advanced rules", text: "Bonuses, clawbacks, draws, guarantees and split commissions." },
  { href: "/compensation", title: "Compensation", text: "Base salary, target variable, OTE and employer cost." },
  { href: "/results", title: "Results", text: "KPIs, payout curve, breakdowns and exports." },
];

export default function SetupPage() {
  const { plan, update } = usePlan();
  const startFromScratch = usePlanStore((s) => s.startFromScratch);
  const createPlan = usePlanStore((s) => s.createPlan);
  const payoutOptions = allowedPayoutFrequencies(plan.calculationPeriod).map((t) => ({ value: t, label: PERIOD_TYPE_LABELS[t] }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plan setup"
        description="Define how commissions are calculated and paid. All results update live as you edit."
        actions={
          <>
            <Button onClick={() => createPlan("demo")}>
              <Sparkles className="h-3.5 w-3.5" />
              Load demo plan
            </Button>
            <Button onClick={startFromScratch}>
              <Eraser className="h-3.5 w-3.5" />
              Start from scratch
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Plan details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Description" className="sm:col-span-2">
                <TextInput
                  value={plan.description}
                  onChange={(description) => update((p) => ({ ...p, description }))}
                  placeholder="e.g. 2027 AE plan proposal"
                />
              </Field>
              <Field label="Currency" hint="Display format only. No FX conversion is applied.">
                <Select<CurrencyCode>
                  value={plan.currency}
                  onChange={(currency) => update((p) => ({ ...p, currency }))}
                  options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
                />
              </Field>
              <Field label="Primary metric" hint="Used to label commission cost ratios.">
                <Select<PrimaryMetric>
                  value={plan.primaryMetric}
                  onChange={(primaryMetric) => update((p) => ({ ...p, primaryMetric }))}
                  options={[
                    { value: "arr", label: "ARR" },
                    { value: "revenue", label: "Revenue" },
                    { value: "bookings", label: "Bookings" },
                  ]}
                />
              </Field>
            </div>
          </Card>

          <Card title="Calculation period" description="The calculation period and payout frequency are separate settings.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field group label="Calculation period">
                <Segmented<PeriodType>
                  value={plan.calculationPeriod}
                  onChange={(t) => update((p) => changeCalculationPeriod(p, t))}
                  options={PERIOD_OPTIONS}
                />
              </Field>
              <Field group label="Mode" hint={plan.mode === "single" ? "Calculate one period." : "Model the full year; each period is calculated independently."}>
                <Segmented
                  value={plan.mode}
                  onChange={(mode) => update((p) => ({ ...p, mode }))}
                  options={[
                    { value: "single", label: "Single period" },
                    { value: "multi", label: "Full year (multi-period)" },
                  ]}
                />
              </Field>
              {plan.mode === "single" && plan.calculationPeriod !== "annual" && (
                <Field label="Period">
                  <Select
                    value={String(plan.singlePeriodIndex)}
                    onChange={(v) => update((p) => ({ ...p, singlePeriodIndex: Number(v) }))}
                    options={Array.from({ length: periodCount(plan.calculationPeriod) }, (_, i) => ({
                      value: String(i),
                      label: periodLabel(plan.calculationPeriod, i),
                    }))}
                  />
                </Field>
              )}
              <Field label="Payout frequency" hint="Payouts group calculated periods, e.g. monthly calculation paid quarterly.">
                <Select<PeriodType>
                  value={plan.payoutFrequency}
                  onChange={(payoutFrequency) => update((p) => ({ ...p, payoutFrequency }))}
                  options={payoutOptions}
                />
              </Field>
            </div>
          </Card>

          <Card title="Configuration mode">
            <div className="space-y-3">
              <Segmented<ConfigMode>
                value={plan.configMode}
                onChange={(configMode) => update((p) => ({ ...p, configMode }))}
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "advanced", label: "Advanced (tier builder)" },
                ]}
              />
              <Alert>
                {plan.configMode === "simple"
                  ? "Simple mode: a base commission rate with an optional accelerator above quota, threshold and cap. Covers most plans."
                  : "Advanced mode: build any number of attainment tiers per revenue type (e.g. 0–50% → 0%, 50–100% → 10%, 100%+ → 15%)."}
              </Alert>
            </div>
          </Card>
        </div>

        <Card title="Next steps" bodyClassName="p-0">
          <ol className="divide-y divide-slate-100">
            {STEPS.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-1 text-sm font-medium text-slate-800">
                      {s.title}
                      <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="text-xs text-slate-500">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
