"use client";

import { Badge, DataTable, EmptyState, Td, Th } from "@/components/ui/layout";
import { useMoney } from "@/hooks/useCalculation";
import type { CalculationResult, CommissionPlan, OTEResult } from "@/lib/commission-engine/types";
import { formatPct } from "@/lib/format/currency";

const METRIC_LABEL = { arr: "ARR", revenue: "revenue", bookings: "bookings" } as const;

export function OTEScenarioTable({ plan, ote }: { plan: CommissionPlan; ote: OTEResult }) {
  const { fmt0 } = useMoney(plan.currency);
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Quota attainment</Th>
          <Th align="right">Variable pay</Th>
          <Th align="right">% of target variable</Th>
          <Th align="right">Total compensation</Th>
        </tr>
      </thead>
      <tbody>
        {ote.scenarios.map((s) => (
          <tr key={s.attainmentPct} className={s.attainmentPct === 100 ? "bg-brand-50/50 font-medium" : ""}>
            <Td>{s.attainmentPct}%</Td>
            <Td align="right">{fmt0(s.variable)}</Td>
            <Td align="right">{formatPct(s.pctOfTargetVariable)}</Td>
            <Td align="right">{fmt0(s.totalCompensation)}</Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function EmployerCostTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  const c = result.employerCost;
  const f = plan.features;
  const rows: Array<{ label: string; value: number; show: boolean; negative?: boolean; strong?: boolean }> = [
    { label: "Base salary", value: c.baseSalary, show: true },
    { label: "Commission", value: c.commission, show: true },
    { label: "Bonuses", value: c.bonuses, show: f.bonuses },
    { label: "Guaranteed commission top-ups", value: c.guarantee, show: f.guarantee },
    { label: "Draw advances", value: c.drawAdvances, show: f.draw },
    { label: "Draw recoveries", value: c.drawRecoveries, show: f.draw, negative: true },
    { label: "Clawbacks", value: c.clawbacks, show: f.clawbacks, negative: true },
    { label: "Total cash compensation", value: c.totalCashCompensation, show: true, strong: true },
    { label: `Employer overhead (${plan.ote.employerOverheadPct}%)`, value: c.overhead, show: plan.ote.employerOverheadPct > 0 },
    { label: "Total employer cost", value: c.totalCost, show: true, strong: true },
  ];
  const metric = METRIC_LABEL[plan.primaryMetric];
  return (
    <div>
      <DataTable>
        <tbody>
          {rows
            .filter((r) => r.show)
            .map((r) => (
              <tr key={r.label} className={r.strong ? "bg-slate-50 font-semibold" : ""}>
                <Td>{r.label}</Td>
                <Td align="right" className={r.negative && r.value ? "text-red-600" : ""}>
                  {r.negative && r.value ? `−${fmt(r.value)}` : fmt(r.value)}
                </Td>
              </tr>
            ))}
        </tbody>
      </DataTable>
      <div className="grid grid-cols-2 gap-3 p-4 text-xs">
        <div>
          <div className="text-slate-500">Variable comp as % of {metric}</div>
          <div className="num mt-0.5 text-base font-semibold text-slate-900">{formatPct(c.commissionPctOfRevenue, 2)}</div>
        </div>
        <div>
          <div className="text-slate-500">Total cost as % of {metric}</div>
          <div className="num mt-0.5 text-base font-semibold text-slate-900">{formatPct(c.totalCostPctOfRevenue, 2)}</div>
        </div>
      </div>
    </div>
  );
}

export function PeriodBreakdownTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  const f = plan.features;
  const t = result.totals;
  const cols = [
    { key: "quota", label: "Quota", show: true },
    { key: "actual", label: "Actual", show: true },
    { key: "attainment", label: "Attainment", show: true },
    { key: "individual", label: f.team ? "Individual" : "Commission", show: true },
    { key: "team", label: "Team", show: f.team },
    { key: "cap", label: "Plan cap", show: t.planCapReduction > 0 },
    { key: "bonus", label: "Bonus", show: f.bonuses },
    { key: "guarantee", label: "Guarantee", show: f.guarantee },
    { key: "clawback", label: "Clawback", show: f.clawbacks },
    { key: "net", label: "Net earned", show: true },
    { key: "draw", label: "Draw adj.", show: f.draw || t.drawRecoveries > 0 || t.drawAdvances > 0 },
    { key: "payout", label: "Payout", show: true },
  ].filter((c) => c.show);

  const cell = (key: string, p: CalculationResult["periods"][number] | null) => {
    const v = p ?? null;
    switch (key) {
      case "quota":
        return fmt(v ? v.quota : t.quota);
      case "actual":
        return fmt(v ? v.actual : t.actual);
      case "attainment":
        return formatPct(v ? v.attainmentPct : t.attainmentPct);
      case "individual":
        return fmt(v ? v.individualCommission : t.individualCommission);
      case "team":
        return fmt(v ? v.teamCommission : t.teamCommission);
      case "cap":
        return `−${fmt(v ? v.planCapReduction : t.planCapReduction)}`;
      case "bonus":
        return fmt(v ? v.bonusTotal : t.bonuses);
      case "guarantee":
        return fmt(v ? v.guaranteeTopUp : t.guarantee);
      case "clawback":
        return `−${fmt(v ? v.clawback : t.clawbacks)}`;
      case "net":
        return fmt(v ? v.netEarned : t.earnedVariable);
      case "draw": {
        const adv = v ? v.draw.advance - v.draw.recovery : t.drawAdvances - t.drawRecoveries;
        return adv === 0 ? fmt(0) : adv > 0 ? `+${fmt(adv)}` : `−${fmt(-adv)}`;
      }
      case "payout":
        return fmt(v ? v.payout : t.payout);
    }
  };

  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Period</Th>
          {cols.map((c) => (
            <Th key={c.key} align="right">
              {c.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.periods.map((p) => (
          <tr key={p.periodId}>
            <Td className="font-medium text-slate-700">
              <span className="flex items-center gap-1.5">
                {p.label}
                {p.isRampPeriod && <Badge tone="amber">Ramp {p.rampPct}%</Badge>}
              </span>
            </Td>
            {cols.map((c) => (
              <Td key={c.key} align="right" className={c.key === "payout" ? "font-medium" : ""}>
                {cell(c.key, p)}
              </Td>
            ))}
          </tr>
        ))}
        {result.periods.length > 1 && (
          <tr className="bg-slate-50 font-semibold">
            <Td>Total</Td>
            {cols.map((c) => (
              <Td key={c.key} align="right">
                {cell(c.key, null)}
              </Td>
            ))}
          </tr>
        )}
      </tbody>
    </DataTable>
  );
}

export function RevenueTypeBreakdownTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  const multi = result.periods.length > 1;
  return (
    <DataTable>
      <thead>
        <tr>
          {multi && <Th>Period</Th>}
          <Th>Revenue type</Th>
          <Th align="right">Quota</Th>
          <Th align="right">Credited</Th>
          <Th align="right">Attainment</Th>
          <Th align="right">Gross</Th>
          <Th align="right">Cap / weighting</Th>
          <Th align="right">Commission</Th>
        </tr>
      </thead>
      <tbody>
        {result.periods.flatMap((p) =>
          p.revenueTypes.map((r) => (
            <tr key={`${p.periodId}-${r.revenueTypeId}`}>
              {multi && <Td className="text-slate-500">{p.label}</Td>}
              <Td className="font-medium text-slate-700">
                <span className="flex items-center gap-1.5">
                  {r.label}
                  {r.belowThreshold && <Badge tone="amber">Below threshold</Badge>}
                  {r.method === "flat" && <Badge>Flat</Badge>}
                </span>
              </Td>
              <Td align="right">{r.quotaBased ? fmt(r.quota) : "–"}</Td>
              <Td align="right">{fmt(r.credited)}</Td>
              <Td align="right">{formatPct(r.attainmentPct)}</Td>
              <Td align="right">{fmt(r.grossCommission)}</Td>
              <Td align="right" className="text-slate-500">
                {r.commission !== r.grossCommission ? `−${fmt(r.grossCommission - r.commission)}` : "–"}
              </Td>
              <Td align="right" className="font-medium">
                {fmt(r.commission)}
              </Td>
            </tr>
          )),
        )}
        {result.byRevenueType
          .filter((x) => x.id === "team" || x.id === "plan-cap")
          .map((x) => (
            <tr key={x.id}>
              {multi && <Td />}
              <Td className="font-medium text-slate-700" colSpan={6}>
                {x.label}
              </Td>
              <Td align="right" className="font-medium">
                {fmt(x.amount)}
              </Td>
            </tr>
          ))}
        <tr className="bg-slate-50 font-semibold">
          {multi && <Td />}
          <Td colSpan={6}>Total commission</Td>
          <Td align="right">{fmt(result.totals.commission)}</Td>
        </tr>
      </tbody>
    </DataTable>
  );
}

export function TierBreakdownTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  const multi = result.periods.length > 1;
  const rows = result.periods.flatMap((p) =>
    p.revenueTypes.flatMap((r) => r.tierLines.map((l) => ({ period: p.label, type: r.label, line: l, key: `${p.periodId}-${r.revenueTypeId}-${l.tierId}` }))),
  );
  if (rows.length === 0) return <EmptyState>No tier data.</EmptyState>;
  return (
    <DataTable>
      <thead>
        <tr>
          {multi && <Th>Period</Th>}
          <Th>Revenue type</Th>
          <Th>Tier</Th>
          <Th align="right">Rate</Th>
          <Th align="right">Revenue in tier</Th>
          <Th align="right">Commission</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ period, type, line, key }) => (
          <tr key={key} className={line.commission === 0 && line.revenueInTier === 0 ? "text-slate-400" : ""}>
            {multi && <Td>{period}</Td>}
            <Td>{type}</Td>
            <Td>{line.label}</Td>
            <Td align="right">{formatPct(line.rate, 2)}</Td>
            <Td align="right">{fmt(line.revenueInTier)}</Td>
            <Td align="right" className="font-medium">
              {fmt(line.commission)}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function BonusBreakdownTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  if (!plan.features.bonuses) return <EmptyState>Bonuses are not enabled.</EmptyState>;
  const rows = result.periods.flatMap((p) => p.bonuses.map((b) => ({ period: p.label, attainment: p.attainmentPct, b })));
  if (rows.length === 0) return <EmptyState>No bonus milestones reached.</EmptyState>;
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Period</Th>
          <Th align="right">Milestone</Th>
          <Th align="right">Amount</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ period, b }) => (
          <tr key={`${period}-${b.bonusRuleId}`}>
            <Td>{period}</Td>
            <Td align="right">{b.attainmentPct}%</Td>
            <Td align="right" className="font-medium">
              {fmt(b.amount)}
            </Td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <Td colSpan={2}>Total bonuses</Td>
          <Td align="right">{fmt(result.totals.bonuses)}</Td>
        </tr>
      </tbody>
    </DataTable>
  );
}

export function DrawGuaranteeTable({ plan, result, kind }: { plan: CommissionPlan; result: CalculationResult; kind: "draw" | "guarantee" | "clawback" }) {
  const { fmt } = useMoney(plan.currency);
  const f = plan.features;
  if (kind === "draw" && !f.draw) return <EmptyState>Draw against commission is not enabled.</EmptyState>;
  if (kind === "guarantee" && !f.guarantee) return <EmptyState>Guaranteed commission is not enabled.</EmptyState>;
  if (kind === "clawback" && !f.clawbacks) return <EmptyState>Clawbacks are not enabled.</EmptyState>;
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Period</Th>
          <Th align="right">Earned</Th>
          {kind === "guarantee" && <Th align="right">Eligible</Th>}
          {kind === "guarantee" && <Th align="right">Top-up</Th>}
          {kind === "clawback" && <Th align="right">Clawback</Th>}
          {kind === "draw" && (
            <>
              <Th align="right">Draw</Th>
              <Th align="right">Advance</Th>
              <Th align="right">Recovery</Th>
              <Th align="right">{plan.draw.type === "recoverable" ? "Balance" : "Forgiven"}</Th>
            </>
          )}
          <Th align="right">Payout</Th>
        </tr>
      </thead>
      <tbody>
        {result.periods.map((p) => (
          <tr key={p.periodId}>
            <Td className="font-medium text-slate-700">{p.label}</Td>
            <Td align="right">{fmt(kind === "draw" ? p.netEarned : p.earned)}</Td>
            {kind === "guarantee" && (
              <Td align="right">{plan.guarantee.appliesTo === "all_periods" || p.isRampPeriod ? "Yes" : "No"}</Td>
            )}
            {kind === "guarantee" && <Td align="right">{fmt(p.guaranteeTopUp)}</Td>}
            {kind === "clawback" && <Td align="right" className="text-red-600">{p.clawback ? `−${fmt(p.clawback)}` : fmt(0)}</Td>}
            {kind === "draw" && (
              <>
                <Td align="right">{fmt(p.draw.drawAmount)}</Td>
                <Td align="right">{fmt(p.draw.advance)}</Td>
                <Td align="right">{p.draw.recovery ? `−${fmt(p.draw.recovery)}` : fmt(0)}</Td>
                <Td align="right">{fmt(plan.draw.type === "recoverable" ? p.draw.balanceAfter : p.draw.forgiven)}</Td>
              </>
            )}
            <Td align="right" className="font-medium">
              {fmt(p.payout)}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function SplitTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  if (!result.splits) return <EmptyState>Split commissions are not enabled.</EmptyState>;
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Role</Th>
          <Th align="right">Share</Th>
          <Th align="right">Payout</Th>
        </tr>
      </thead>
      <tbody>
        {result.splits.lines.map((l) => (
          <tr key={l.splitRuleId}>
            <Td className="font-medium text-slate-700">{l.role}</Td>
            <Td align="right">{formatPct(l.pct, 2)}</Td>
            <Td align="right" className="font-medium">
              {fmt(l.amount)}
            </Td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <Td>Total</Td>
          <Td align="right" className={result.splits.valid ? "" : "text-red-600"}>
            {formatPct(result.splits.totalPct, 2)}
          </Td>
          <Td align="right">{fmt(result.splits.pool)}</Td>
        </tr>
      </tbody>
    </DataTable>
  );
}

export function PayoutScheduleTable({ plan, result }: { plan: CommissionPlan; result: CalculationResult }) {
  const { fmt } = useMoney(plan.currency);
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Payout</Th>
          <Th>Covers</Th>
          <Th align="right">Amount</Th>
        </tr>
      </thead>
      <tbody>
        {result.payouts.map((g) => (
          <tr key={g.label}>
            <Td className="font-medium text-slate-700">{g.label}</Td>
            <Td className="text-slate-500">
              {g.periodIds.map((id) => result.periods.find((p) => p.periodId === id)?.label).join(", ")}
            </Td>
            <Td align="right" className="font-medium">
              {fmt(g.payout)}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
