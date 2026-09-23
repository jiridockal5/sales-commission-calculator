import { calculateCommission } from "./calculateCommission";
import { calculatePayoutCurve } from "./calculatePayoutCurve";
import type { CommissionPlan, NamedAmount, PlanComparisonEntry, PlanComparisonResult } from "./types";

function unionLabels(lists: NamedAmount[][]): string[] {
  const seen: string[] = [];
  for (const list of lists) for (const item of list) if (!seen.includes(item.label)) seen.push(item.label);
  return seen;
}

export function calculatePlanComparison(plans: CommissionPlan[]): PlanComparisonResult {
  const entries: PlanComparisonEntry[] = plans.map((plan) => {
    const result = calculateCommission(plan);
    return {
      planId: plan.id,
      planName: plan.name,
      currency: plan.currency,
      totalCommission: result.totals.earnedVariable,
      totalCompensation: result.employerCost.totalCashCompensation,
      effectiveRatePct: result.totals.effectiveRatePct,
      attainmentPct: result.totals.attainmentPct,
      employerCost: result.employerCost.totalCost,
      commissionPctOfRevenue: result.employerCost.commissionPctOfRevenue,
      byPeriod: result.periods.map((p) => ({ id: p.periodId, label: p.label, amount: p.netEarned })),
      byRevenueType: result.byRevenueType,
      payoutCurve: calculatePayoutCurve(plan),
    };
  });

  const curveMap = new Map<number, Record<string, number>>();
  for (const entry of entries) {
    for (const point of entry.payoutCurve) {
      const row = curveMap.get(point.attainmentPct) ?? { attainmentPct: point.attainmentPct };
      row[entry.planId] = point.payout;
      curveMap.set(point.attainmentPct, row);
    }
  }

  return {
    entries,
    periodLabels: unionLabels(entries.map((e) => e.byPeriod)),
    revenueTypeLabels: unionLabels(entries.map((e) => e.byRevenueType)),
    payoutCurves: [...curveMap.values()].sort((a, b) => a.attainmentPct - b.attainmentPct),
  };
}
