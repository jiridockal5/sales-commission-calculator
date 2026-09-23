import type { CalculationResult, CommissionPlan } from "@/lib/commission-engine/types";
import { downloadFile, slugify } from "./download";

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? String(value) : value;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

const n2 = (v: number | null) => (v === null ? null : v.toFixed(2));

/** Builds a multi-section CSV report of a calculation result. */
export function buildResultCsv(plan: CommissionPlan, result: CalculationResult): string {
  const t = result.totals;
  const rows: Cell[][] = [
    ["Sales Commission Calculator"],
    ["Plan", plan.name],
    ["Currency", plan.currency],
    ["Calculation period", plan.calculationPeriod],
    ["Mode", plan.mode],
    ["Payout frequency", plan.payoutFrequency],
    [],
    ["Summary"],
    ["Quota", n2(t.quota)],
    ["Actual", n2(t.actual)],
    ["Quota attainment %", n2(t.attainmentPct)],
    ["Commission", n2(t.commission)],
    ["Bonuses", n2(t.bonuses)],
    ["Guarantee top-ups", n2(t.guarantee)],
    ["Clawbacks", n2(t.clawbacks)],
    ["Net variable earned", n2(t.earnedVariable)],
    ["Total payout", n2(t.payout)],
    ["Effective commission rate %", n2(t.effectiveRatePct)],
    ["OTE attainment %", n2(t.oteAttainmentPct)],
    ["Total employer cost", n2(result.employerCost.totalCost)],
    [],
    ["By period"],
    [
      "Period",
      "Full quota",
      "Ramp %",
      "Quota",
      "Actual",
      "Attainment %",
      "Individual commission",
      "Team commission",
      "Plan cap adjustment",
      "Commission",
      "Bonus",
      "Guarantee",
      "Clawback",
      "Net earned",
      "Draw advance",
      "Draw recovery",
      "Payout",
    ],
    ...result.periods.map((p) => [
      p.label,
      n2(p.fullQuota),
      p.rampPct,
      n2(p.quota),
      n2(p.actual),
      n2(p.attainmentPct),
      n2(p.individualCommission),
      n2(p.teamCommission),
      n2(-p.planCapReduction),
      n2(p.commission),
      n2(p.bonusTotal),
      n2(p.guaranteeTopUp),
      n2(-p.clawback),
      n2(p.netEarned),
      n2(p.draw.advance),
      n2(-p.draw.recovery),
      n2(p.payout),
    ]),
    [],
    ["By revenue type and period"],
    ["Period", "Revenue type", "Quota", "Actual", "Credited", "Attainment %", "Gross commission", "Cap reduction", "Commission"],
    ...result.periods.flatMap((p) =>
      p.revenueTypes.map((r) => [
        p.label,
        r.label,
        n2(r.quota),
        n2(r.actual),
        n2(r.credited),
        n2(r.attainmentPct),
        n2(r.grossCommission),
        n2(-r.capReduction),
        n2(r.commission),
      ]),
    ),
    [],
    ["By tier (gross)"],
    ["Tier", "Commission"],
    ...result.byTier.map((x) => [x.label, n2(x.amount)]),
    [],
    ["Payout schedule"],
    ["Payout", "Amount"],
    ...result.payouts.map((g) => [g.label, n2(g.payout)]),
    [],
    ["Employer cost"],
    ["Base salary", n2(result.employerCost.baseSalary)],
    ["Commission", n2(result.employerCost.commission)],
    ["Bonuses", n2(result.employerCost.bonuses)],
    ["Guarantee top-ups", n2(result.employerCost.guarantee)],
    ["Draw advances", n2(result.employerCost.drawAdvances)],
    ["Draw recoveries", n2(-result.employerCost.drawRecoveries)],
    ["Clawbacks", n2(-result.employerCost.clawbacks)],
    ["Total cash compensation", n2(result.employerCost.totalCashCompensation)],
    ["Employer overhead", n2(result.employerCost.overhead)],
    ["Total employer cost", n2(result.employerCost.totalCost)],
  ];
  if (result.splits) {
    rows.push([], ["Split commission"], ["Role", "Share %", "Amount"]);
    rows.push(...result.splits.lines.map((l) => [l.role, l.pct, n2(l.amount)]));
  }
  return toCsv(rows);
}

export function exportResultCsv(plan: CommissionPlan, result: CalculationResult): void {
  downloadFile(`${slugify(plan.name)}-results.csv`, "\uFEFF" + buildResultCsv(plan, result), "text/csv;charset=utf-8");
}
