import { dec, pct, ratioPct, round2, type Numeric } from "./money";
import type { EmployerCost } from "./types";

export interface EmployerCostInput {
  baseSalary: Numeric;
  commission: Numeric;
  bonuses: Numeric;
  guarantee: Numeric;
  drawAdvances: Numeric;
  drawRecoveries: Numeric;
  clawbacks: Numeric;
  overheadPct: Numeric;
  revenue: Numeric;
}

/**
 * Total cash compensation = base + commission + bonuses + guarantee top-ups
 * + draw advances - draw recoveries - clawbacks (equals base + total payouts).
 */
export function calculateEmployerCost(input: EmployerCostInput): EmployerCost {
  const variable = dec(input.commission)
    .plus(dec(input.bonuses))
    .plus(dec(input.guarantee))
    .plus(dec(input.drawAdvances))
    .minus(dec(input.drawRecoveries))
    .minus(dec(input.clawbacks));
  const cash = dec(input.baseSalary).plus(variable);
  const overhead = round2(cash.mul(pct(input.overheadPct)));
  const totalCost = round2(cash).plus(overhead);
  return {
    baseSalary: round2(input.baseSalary).toNumber(),
    commission: round2(input.commission).toNumber(),
    bonuses: round2(input.bonuses).toNumber(),
    guarantee: round2(input.guarantee).toNumber(),
    drawAdvances: round2(input.drawAdvances).toNumber(),
    drawRecoveries: round2(input.drawRecoveries).toNumber(),
    clawbacks: round2(input.clawbacks).toNumber(),
    totalCashCompensation: round2(cash).toNumber(),
    overhead: overhead.toNumber(),
    totalCost: totalCost.toNumber(),
    commissionPctOfRevenue: ratioPct(variable, input.revenue),
    totalCostPctOfRevenue: ratioPct(totalCost, input.revenue),
  };
}
