import { calculateCommission } from "./calculateCommission";
import { dec, ratioPct, round2 } from "./money";
import type { CommissionPlan, OTEResult, OTEScenario } from "./types";

export const OTE_SCENARIO_ATTAINMENTS = [50, 75, 100, 125, 150];

/** Variable pay (commission + bonuses) the plan produces at a given attainment for all modeled periods. */
export function simulateAtAttainment(plan: CommissionPlan, attainmentPct: number): OTEScenario {
  const result = calculateCommission(plan, { attainmentOverridePct: attainmentPct, ignoreAdjustments: true });
  const variable = dec(result.totals.commission).plus(result.totals.bonuses);
  return {
    attainmentPct,
    variable: round2(variable).toNumber(),
    totalCompensation: round2(variable.plus(result.totals.baseSalary)).toNumber(),
    pctOfTargetVariable: ratioPct(variable, result.totals.targetVariable),
  };
}

/** OTE figures are annual; scenarios cover the modeled periods. */
export function calculateOTE(plan: CommissionPlan, attainments = OTE_SCENARIO_ATTAINMENTS): OTEResult {
  const ote = dec(plan.ote.baseSalary).plus(plan.ote.targetVariable);
  return {
    baseSalary: round2(plan.ote.baseSalary).toNumber(),
    targetVariable: round2(plan.ote.targetVariable).toNumber(),
    ote: round2(ote).toNumber(),
    variablePct: ratioPct(plan.ote.targetVariable, ote),
    scenarios: attainments.map((a) => simulateAtAttainment(plan, a)),
  };
}
