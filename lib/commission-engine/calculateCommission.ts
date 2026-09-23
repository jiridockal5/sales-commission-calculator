import { calculateBonuses } from "./calculateBonuses";
import { calculateClawbacks } from "./calculateClawbacks";
import { calculateDraw } from "./calculateDraw";
import { calculateEmployerCost } from "./calculateEmployerCost";
import { calculateGuarantee } from "./calculateGuarantee";
import { calculateMarginalTiers } from "./calculateMarginalTiers";
import { calculatePayoutSchedule } from "./calculatePayoutSchedule";
import {
  calculateQuotaAttainment,
  creditedRevenue,
  getRampPct,
  rampAdjustedQuota,
} from "./calculateQuotaAttainment";
import { calculateRetroactiveTiers } from "./calculateRetroactiveTiers";
import { calculateSplitCommission } from "./calculateSplitCommission";
import { dec, max, min, pct, ratioPct, round2, sum, sumMoney, type Dec } from "./money";
import { activePeriods, yearFraction } from "./periods";
import { onTargetTier, resolveTiers, tierAt, tierLabel } from "./tiers";
import type {
  BonusResult,
  CalculationResult,
  CommissionPlan,
  CommissionRule,
  ConfigMode,
  FeatureToggles,
  NamedAmount,
  PerformanceData,
  PeriodResult,
  Quota,
  QuotaScope,
  RevenueType,
  RevenueTypeResult,
  TierBreakdownLine,
} from "./types";

export interface CalculationOptions {
  /**
   * Simulates every quota-based revenue type (individual and team) at this attainment
   * percent of its effective quota. Non-quota types keep their actual values.
   */
  attainmentOverridePct?: number;
  /** Ignore clawbacks, guarantees and draws (used for payout curves / OTE scenarios). */
  ignoreAdjustments?: boolean;
}

export interface RevenueTypeCommissionInput {
  revenueType: RevenueType;
  rule: CommissionRule;
  fullQuota: number;
  rampPct: number;
  actual: number;
  excludedAmount: number;
  configMode: ConfigMode;
  features: Pick<FeatureToggles, "accelerators" | "threshold" | "caps">;
  attainmentOverridePct?: number;
  /** Apply the per-period monetary cap (disabled for team payout factor calculation). */
  applyPayoutCap?: boolean;
}

/** Commission for one revenue type in one period, before individual/team weighting. */
export function calculateRevenueTypeCommission(input: RevenueTypeCommissionInput): RevenueTypeResult {
  const { revenueType, rule, features } = input;
  const quota = rampAdjustedQuota(input.fullQuota, input.rampPct);
  const override = revenueType.quotaBased ? input.attainmentOverridePct : undefined;

  const actual = override !== undefined ? round2(dec(quota).mul(pct(override))).toNumber() : input.actual;
  const credited =
    override !== undefined
      ? actual
      : creditedRevenue(actual, rule.requireInPeriod ? input.excludedAmount : 0, revenueType.weighting);

  let lines: TierBreakdownLine[];
  let attainmentPct: number | null = null;
  let belowThreshold = false;
  let commissionable = credited;
  let method: RevenueTypeResult["method"];

  if (!revenueType.quotaBased) {
    method = "flat";
    lines = [
      {
        tierId: `${rule.id}-flat`,
        label: "Flat rate",
        fromPct: 0,
        toPct: null,
        rate: rule.baseRate,
        revenueInTier: credited,
        commission: round2(dec(credited).mul(pct(rule.baseRate))).toNumber(),
      },
    ];
  } else {
    method = rule.accelerationMethod;
    const tiers = resolveTiers(rule, input.configMode, features.accelerators);
    attainmentPct = calculateQuotaAttainment(credited, quota);

    if (features.caps && rule.maxAttainmentPct !== null && quota > 0) {
      commissionable = min(credited, dec(quota).mul(pct(rule.maxAttainmentPct))).toNumber();
    }
    // In advanced mode a tier with a positive rate is explicit. The separate threshold
    // must not zero that band; a 0% tier is how "no commission" is expressed.
    const covering = quota > 0 && attainmentPct !== null ? tierAt(tiers, attainmentPct) : null;
    const explicitPositiveTier = input.configMode === "advanced" && covering !== null && covering.rate > 0;
    belowThreshold =
      features.threshold &&
      !explicitPositiveTier &&
      rule.thresholdPct > 0 &&
      attainmentPct !== null &&
      attainmentPct < rule.thresholdPct;

    if (belowThreshold) {
      lines = tiers.map((tier) => ({
        tierId: tier.id,
        label: tierLabel(tier),
        fromPct: tier.fromPct,
        toPct: tier.toPct,
        rate: tier.rate,
        revenueInTier: 0,
        commission: 0,
      }));
    } else if (quota <= 0) {
      // No quota: pay the on-target (100%) rate on all credited revenue.
      const onTarget = onTargetTier(tiers);
      lines = onTarget
        ? [
            {
              tierId: onTarget.id,
              label: `${tierLabel(onTarget)} (no quota)`,
              fromPct: onTarget.fromPct,
              toPct: onTarget.toPct,
              rate: onTarget.rate,
              revenueInTier: commissionable,
              commission: round2(dec(commissionable).mul(pct(onTarget.rate))).toNumber(),
            },
          ]
        : [];
    } else if (rule.accelerationMethod === "retroactive") {
      lines = calculateRetroactiveTiers(commissionable, quota, tiers).lines;
    } else {
      lines = calculateMarginalTiers(commissionable, quota, tiers).lines;
    }
  }

  const gross = sumMoney(lines.map((l) => l.commission));
  let capped = dec(gross);
  if ((input.applyPayoutCap ?? true) && features.caps && rule.maxPayoutPerPeriod !== null) {
    capped = min(capped, max(rule.maxPayoutPerPeriod, 0));
  }

  return {
    revenueTypeId: revenueType.id,
    key: revenueType.key,
    label: revenueType.label,
    quotaBased: revenueType.quotaBased,
    fullQuota: round2(input.fullQuota).toNumber(),
    quota,
    actual: round2(actual).toNumber(),
    credited,
    commissionable,
    attainmentPct,
    belowThreshold,
    method,
    tierLines: lines,
    grossCommission: gross,
    capReduction: round2(dec(gross).minus(capped)).toNumber(),
    commission: round2(capped).toNumber(),
  };
}

function findQuota(quotas: Quota[], periodId: string, revenueTypeId: string, scope: QuotaScope): number {
  return quotas.find((q) => q.periodId === periodId && q.revenueTypeId === revenueTypeId && q.scope === scope)?.amount ?? 0;
}

function findPerformance(
  performance: PerformanceData[],
  periodId: string,
  revenueTypeId: string,
  scope: QuotaScope,
): PerformanceData | undefined {
  return performance.find((p) => p.periodId === periodId && p.revenueTypeId === revenueTypeId && p.scope === scope);
}

/** Calculates the full commission result for a plan. Pure: no side effects, no React. */
export function calculateCommission(plan: CommissionPlan, options: CalculationOptions = {}): CalculationResult {
  const f = plan.features;
  const warnings: string[] = [];
  const periods = activePeriods(plan);
  const revenueTypes = plan.revenueTypes.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const periodFraction = yearFraction(plan.calculationPeriod);
  const basePerPeriod = dec(plan.ote.baseSalary).mul(periodFraction);
  const targetVariablePerPeriod = dec(plan.ote.targetVariable).mul(periodFraction);
  const override = options.attainmentOverridePct;
  const adjustments = !options.ignoreAdjustments;

  const individualWeight = f.team ? pct(plan.team.individualWeight) : dec(1);
  const teamWeight = f.team ? pct(plan.team.teamWeight) : dec(0);
  if (f.team && !dec(plan.team.individualWeight).plus(plan.team.teamWeight).eq(100)) {
    warnings.push("Individual and team weights do not add up to 100%.");
  }

  const missingRules = new Set<string>();
  let cumulativeCommission: Dec = dec(0);

  // Pass 1: commission per period.
  const partial = periods.map((period, position) => {
    const rampPct = f.ramp ? getRampPct(plan.ramp, position) : 100;
    const typeResults: RevenueTypeResult[] = [];
    let teamCommissionAtActual = dec(0);
    let teamCommissionAtQuota = dec(0);
    let teamQuota = dec(0);
    let teamActual = dec(0);

    for (const revenueType of revenueTypes) {
      const rule = plan.rules.find((r) => r.revenueTypeId === revenueType.id);
      if (!rule) {
        missingRules.add(revenueType.label);
        continue;
      }
      const perf = findPerformance(plan.performance, period.id, revenueType.id, "individual");
      const base = {
        revenueType,
        rule,
        configMode: plan.configMode,
        features: f,
      };
      const result = calculateRevenueTypeCommission({
        ...base,
        fullQuota: revenueType.quotaBased ? findQuota(plan.quotas, period.id, revenueType.id, "individual") : 0,
        rampPct,
        actual: perf?.actual ?? 0,
        excludedAmount: perf?.excludedAmount ?? 0,
        attainmentOverridePct: override,
      });
      if (revenueType.quotaBased && f.team) {
        result.commission = round2(dec(result.commission).mul(individualWeight)).toNumber();
      }
      typeResults.push(result);

      if (f.team && revenueType.quotaBased) {
        const tQuota = findQuota(plan.quotas, period.id, revenueType.id, "team");
        const tPerf = findPerformance(plan.performance, period.id, revenueType.id, "team");
        const teamInput = { ...base, fullQuota: tQuota, rampPct: 100, excludedAmount: 0, applyPayoutCap: false };
        const atActual = calculateRevenueTypeCommission({
          ...teamInput,
          actual: tPerf?.actual ?? 0,
          attainmentOverridePct: override,
        });
        const atQuota = calculateRevenueTypeCommission({ ...teamInput, actual: 0, attainmentOverridePct: 100 });
        teamCommissionAtActual = teamCommissionAtActual.plus(atActual.grossCommission);
        teamCommissionAtQuota = teamCommissionAtQuota.plus(atQuota.grossCommission);
        teamQuota = teamQuota.plus(atActual.quota);
        teamActual = teamActual.plus(atActual.credited);
      }
    }

    let team: PeriodResult["team"] = null;
    if (f.team) {
      const factor = teamCommissionAtQuota.gt(0) ? teamCommissionAtActual.div(teamCommissionAtQuota) : dec(0);
      const teamTarget = targetVariablePerPeriod.mul(teamWeight);
      team = {
        quota: round2(teamQuota).toNumber(),
        actual: round2(teamActual).toNumber(),
        attainmentPct: calculateQuotaAttainment(teamActual, teamQuota),
        payoutFactor: factor.toDecimalPlaces(4).toNumber(),
        targetVariable: round2(teamTarget).toNumber(),
        commission: round2(teamTarget.mul(factor)).toNumber(),
      };
    }

    const quotaBased = typeResults.filter((r) => r.quotaBased);
    const quota = sum(quotaBased.map((r) => r.quota));
    const creditedQuotaRevenue = sum(quotaBased.map((r) => r.credited));
    const individualCommission = sumMoney(typeResults.map((r) => r.commission));
    const teamCommission = team?.commission ?? 0;
    const beforeCap = dec(individualCommission).plus(teamCommission);

    let commission = beforeCap;
    if (f.caps && plan.cap.maxTotalPayout !== null) {
      const remaining = max(dec(plan.cap.maxTotalPayout).minus(cumulativeCommission), 0);
      commission = min(beforeCap, remaining);
    }
    cumulativeCommission = cumulativeCommission.plus(commission);

    return {
      period,
      rampPct,
      typeResults,
      team,
      fullQuota: sum(quotaBased.map((r) => r.fullQuota)),
      quota,
      creditedQuotaRevenue,
      actual: sum(typeResults.map((r) => r.actual)),
      commissionableRevenue: sum(typeResults.map((r) => r.credited)),
      attainmentPct: calculateQuotaAttainment(creditedQuotaRevenue, quota),
      individualCommission,
      teamCommission,
      planCapReduction: round2(beforeCap.minus(commission)).toNumber(),
      commission: round2(commission).toNumber(),
    };
  });

  for (const label of missingRules) warnings.push(`No commission rule configured for ${label}.`);

  // Bonuses.
  const bonusesByPeriod: BonusResult[][] = partial.map(() => []);
  if (f.bonuses && partial.length > 0) {
    if (plan.bonusEvaluation === "annual") {
      const totalQuota = sum(partial.map((p) => p.quota));
      const totalCredited = sum(partial.map((p) => p.creditedQuotaRevenue));
      bonusesByPeriod[partial.length - 1] = calculateBonuses(
        calculateQuotaAttainment(totalCredited, totalQuota),
        plan.bonuses,
      );
    } else {
      partial.forEach((p, i) => {
        bonusesByPeriod[i] = calculateBonuses(p.attainmentPct, plan.bonuses);
      });
    }
  }

  // Pass 2: guarantee, clawbacks, then draw ledger.
  const staged = partial.map((p, i) => {
    const bonusTotal = sumMoney(bonusesByPeriod[i].map((b) => b.amount));
    const earned = dec(p.commission).plus(bonusTotal);
    const isRampPeriod = f.ramp && p.rampPct < 100;
    const guaranteeEligible =
      adjustments && f.guarantee && (plan.guarantee.appliesTo === "all_periods" || isRampPeriod);
    const guaranteeTopUp = calculateGuarantee(earned, plan.guarantee.amountPerPeriod, guaranteeEligible);
    const clawback =
      adjustments && f.clawbacks ? calculateClawbacks(p.period.id, plan.clawbackEntries, plan.clawbackRules) : 0;
    const netEarned = round2(earned.plus(guaranteeTopUp).minus(clawback)).toNumber();
    return { ...p, bonusTotal, earned: round2(earned).toNumber(), isRampPeriod, guaranteeTopUp, clawback, netEarned };
  });

  const drawRule = adjustments && f.draw ? plan.draw : null;
  const draw = calculateDraw(
    staged.map((s) => s.netEarned),
    drawRule,
  );

  const periodResults: PeriodResult[] = staged.map((s, i) => ({
    periodId: s.period.id,
    label: s.period.label,
    index: s.period.index,
    rampPct: s.rampPct,
    isRampPeriod: s.isRampPeriod,
    fullQuota: round2(s.fullQuota).toNumber(),
    quota: round2(s.quota).toNumber(),
    actual: round2(s.actual).toNumber(),
    commissionableRevenue: round2(s.commissionableRevenue).toNumber(),
    attainmentPct: s.attainmentPct,
    revenueTypes: s.typeResults,
    team: s.team,
    individualCommission: s.individualCommission,
    teamCommission: s.teamCommission,
    planCapReduction: s.planCapReduction,
    commission: s.commission,
    bonuses: bonusesByPeriod[i],
    bonusTotal: s.bonusTotal,
    earned: s.earned,
    guaranteeTopUp: s.guaranteeTopUp,
    clawback: s.clawback,
    netEarned: s.netEarned,
    draw: draw.entries[i],
    payout: draw.payouts[i],
    targetVariable: round2(targetVariablePerPeriod).toNumber(),
    baseSalary: round2(basePerPeriod).toNumber(),
  }));

  if (draw.endingBalance > 0) {
    warnings.push("An outstanding balance (unrecovered draw or clawback) remains at the end of the modeled range.");
  }
  if (periods.length === 0) warnings.push("No periods to calculate.");

  const total = (pick: (p: PeriodResult) => number) => sumMoney(periodResults.map(pick));
  const quotaTotal = total((p) => p.quota);
  const creditedQuotaTotal = sum(staged.map((s) => s.creditedQuotaRevenue));
  const commissionableRevenue = total((p) => p.commissionableRevenue);
  const commission = total((p) => p.commission);
  const bonuses = total((p) => p.bonusTotal);
  const guarantee = total((p) => p.guaranteeTopUp);
  const clawbacks = total((p) => p.clawback);
  const drawAdvances = total((p) => p.draw.advance);
  const drawRecoveries = total((p) => p.draw.recovery);
  const earnedVariable = total((p) => p.netEarned);
  const baseSalary = total((p) => p.baseSalary);
  const targetVariable = total((p) => p.targetVariable);
  const actual = total((p) => p.actual);

  const byRevenueTypeMap = new Map<string, NamedAmount>();
  const byTierMap = new Map<string, NamedAmount>();
  for (const p of periodResults) {
    for (const r of p.revenueTypes) {
      const entry = byRevenueTypeMap.get(r.revenueTypeId) ?? { id: r.revenueTypeId, label: r.label, amount: 0 };
      entry.amount = dec(entry.amount).plus(r.commission).toNumber();
      byRevenueTypeMap.set(r.revenueTypeId, entry);
      for (const line of r.tierLines) {
        const key = `${r.revenueTypeId}:${line.label}`;
        const tierEntry = byTierMap.get(key) ?? { id: key, label: `${r.label} · ${line.label} @ ${line.rate}%`, amount: 0 };
        tierEntry.amount = dec(tierEntry.amount).plus(line.commission).toNumber();
        byTierMap.set(key, tierEntry);
      }
    }
  }
  const byRevenueType = [...byRevenueTypeMap.values()];
  const teamTotal = total((p) => p.teamCommission);
  if (f.team) byRevenueType.push({ id: "team", label: "Team component", amount: teamTotal });
  const planCapReduction = total((p) => p.planCapReduction);
  if (planCapReduction > 0) byRevenueType.push({ id: "plan-cap", label: "Plan cap adjustment", amount: -planCapReduction });

  const employerCost = calculateEmployerCost({
    baseSalary,
    commission,
    bonuses,
    guarantee,
    drawAdvances,
    drawRecoveries,
    clawbacks,
    overheadPct: plan.ote.employerOverheadPct,
    revenue: actual,
  });

  const ote = dec(baseSalary).plus(targetVariable);
  const splits = f.splits ? calculateSplitCommission(earnedVariable, plan.splits) : null;
  if (splits && !splits.valid) warnings.push(`Commission splits total ${splits.totalPct}% instead of 100%.`);

  return {
    planId: plan.id,
    periods: periodResults,
    totals: {
      fullQuota: total((p) => p.fullQuota),
      quota: quotaTotal,
      actual,
      commissionableRevenue,
      attainmentPct: calculateQuotaAttainment(creditedQuotaTotal, quotaTotal),
      commission,
      individualCommission: total((p) => p.individualCommission),
      teamCommission: teamTotal,
      planCapReduction,
      bonuses,
      guarantee,
      clawbacks,
      drawAdvances,
      drawRecoveries,
      drawForgiven: total((p) => p.draw.forgiven),
      drawBalance: draw.endingBalance,
      earnedVariable,
      payout: total((p) => p.payout),
      baseSalary,
      targetVariable,
      ote: round2(ote).toNumber(),
      variableAttainmentPct: ratioPct(earnedVariable, targetVariable),
      oteAttainmentPct: ratioPct(dec(baseSalary).plus(earnedVariable), ote),
      effectiveRatePct: ratioPct(commission, commissionableRevenue),
    },
    byRevenueType,
    byTier: [...byTierMap.values()],
    payouts: calculatePayoutSchedule(
      periods,
      periodResults.map((p) => p.payout),
      plan.payoutFrequency,
    ),
    splits,
    employerCost,
    warnings,
  };
}
