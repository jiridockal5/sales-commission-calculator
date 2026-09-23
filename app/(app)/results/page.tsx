"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { PayoutCurveChart } from "@/components/charts/PayoutCurveChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { KpiGrid } from "@/components/results/KpiGrid";
import {
  BonusBreakdownTable,
  DrawGuaranteeTable,
  EmployerCostTable,
  OTEScenarioTable,
  PayoutScheduleTable,
  PeriodBreakdownTable,
  RevenueTypeBreakdownTable,
  SplitTable,
  TierBreakdownTable,
} from "@/components/results/ResultTables";
import { Button } from "@/components/ui/controls";
import { Alert, Card, PageHeader, Tabs } from "@/components/ui/layout";
import { useCalculation, useMoney, useOTE, usePayoutCurve } from "@/hooks/useCalculation";
import { usePlan } from "@/hooks/usePlan";
import { PAYOUT_CURVE_HIGHLIGHTS } from "@/lib/commission-engine/calculatePayoutCurve";
import { exportResultCsv } from "@/lib/export/csv";
import { formatPct } from "@/lib/format/currency";

type BreakdownTab = "period" | "revenue" | "tier" | "bonus" | "draw" | "guarantee" | "clawback" | "split";

export default function ResultsPage() {
  const { plan } = usePlan();
  const result = useCalculation(plan);
  const curve = usePayoutCurve(plan);
  const ote = useOTE(plan);
  const { fmt0 } = useMoney(plan.currency);
  const [tab, setTab] = useState<BreakdownTab>("period");

  const curveData = curve.map((p) => ({ attainmentPct: p.attainmentPct, payout: p.payout }));
  const highlightRows = PAYOUT_CURVE_HIGHLIGHTS.map((h) => curve.find((p) => p.attainmentPct === h)).filter(Boolean);
  const at100 = curve.find((p) => p.attainmentPct === 100)?.payout ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Results"
        description={`${plan.name} · ${result.periods.map((p) => p.label).join(", ")} · updates live`}
        actions={
          <>
            <Button onClick={() => exportResultCsv(plan, result)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button onClick={() => window.open("/report", "_blank")}>
              <FileText className="h-3.5 w-3.5" />
              PDF report
            </Button>
          </>
        }
      />

      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w) => (
            <Alert key={w} tone="warning">
              {w}
            </Alert>
          ))}
        </div>
      )}

      <KpiGrid plan={plan} result={result} />

      <div className="grid gap-5 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Payout curve"
          description="Variable pay (commission + bonuses) across quota attainment. Steeper slopes above 100% mean a more aggressive plan."
        >
          <PayoutCurveChart
            data={curveData}
            series={[{ key: "payout", name: "Variable pay" }]}
            currency={plan.currency}
            currentAttainment={result.totals.attainmentPct}
          />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {highlightRows.map((p) =>
              p ? (
                <div key={p.attainmentPct} className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[11px] text-slate-500">{p.attainmentPct}%</div>
                  <div className="num break-words text-xs font-semibold text-slate-900">{fmt0(p.payout)}</div>
                  <div className="num text-[10px] text-slate-400">{at100 > 0 ? `${formatPct((p.payout / at100) * 100, 0)} of target` : ""}</div>
                </div>
              ) : null,
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Performance" description="Quota vs actual and variable earned by period.">
          <PerformanceChart periods={result.periods} currency={plan.currency} />
        </Card>
      </div>

      <Card title="Breakdown" bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs<BreakdownTab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "period", label: "By period" },
              { value: "revenue", label: "By revenue type" },
              { value: "tier", label: "By tier" },
              { value: "bonus", label: "Bonuses" },
              { value: "draw", label: "Draw" },
              { value: "guarantee", label: "Guarantee" },
              { value: "clawback", label: "Clawbacks" },
              { value: "split", label: "Split commission" },
            ]}
          />
        </div>
        <div className={tab === "period" || tab === "revenue" || tab === "tier" ? "" : "p-4"}>
          {tab === "period" && <PeriodBreakdownTable plan={plan} result={result} />}
          {tab === "revenue" && <RevenueTypeBreakdownTable plan={plan} result={result} />}
          {tab === "tier" && <TierBreakdownTable plan={plan} result={result} />}
          {tab === "bonus" && <BonusBreakdownTable plan={plan} result={result} />}
          {tab === "draw" && <DrawGuaranteeTable plan={plan} result={result} kind="draw" />}
          {tab === "guarantee" && <DrawGuaranteeTable plan={plan} result={result} kind="guarantee" />}
          {tab === "clawback" && <DrawGuaranteeTable plan={plan} result={result} kind="clawback" />}
          {tab === "split" && <SplitTable plan={plan} result={result} />}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Commission at attainment levels" bodyClassName="p-0">
          <OTEScenarioTable plan={plan} ote={ote} />
        </Card>
        <Card title="Employer cost" bodyClassName="p-0">
          <EmployerCostTable plan={plan} result={result} />
        </Card>
        <Card title="Payout schedule" description={`Paid ${plan.payoutFrequency.replace("_", "-")}.`} bodyClassName="p-0">
          <PayoutScheduleTable plan={plan} result={result} />
        </Card>
      </div>

      <Card title="Effective commission rate">
        <p className="text-sm text-slate-700">
          <span className="num font-semibold">{fmt0(result.totals.commission)}</span> commission ÷{" "}
          <span className="num font-semibold">{fmt0(result.totals.commissionableRevenue)}</span> commissionable revenue ={" "}
          <span className="num font-semibold text-brand-700">{formatPct(result.totals.effectiveRatePct, 2)}</span>
        </p>
      </Card>
    </div>
  );
}
