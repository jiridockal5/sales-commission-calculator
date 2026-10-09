import { dec, money, D } from "@/lib/commission-engine/money";
import type Decimal from "decimal.js";
import type {
  TeamDefinition,
  TeamMember,
  DerivedMemberValues,
  TeamTotals,
  TeamCalculationResult,
  CurrencyCode,
  VariablePayoutRules,
  MemberScenarioResult,
  TeamScenarioResult,
  TeamScenario,
  ArrPeriod,
  ArrPayoutResult,
} from "./types";
import {
  DEFAULT_ACCELERATOR,
  DEFAULT_CAP_PCT,
  DEFAULT_THRESHOLD_PCT,
} from "./export";

const ZERO = new D(0);

export function resolvePayoutRules(member: TeamMember, team: TeamDefinition): VariablePayoutRules {
  return {
    thresholdPct: member.thresholdPct ?? team.defaultThresholdPct ?? DEFAULT_THRESHOLD_PCT,
    accelerator: member.accelerator ?? team.defaultAccelerator ?? DEFAULT_ACCELERATOR,
    capPct: member.capPct === undefined ? (team.defaultCapPct ?? DEFAULT_CAP_PCT) : member.capPct,
  };
}

/** Variable payout for one compensation period at the supplied quota attainment. */
export function calculateVariablePayout(
  targetVariable: number,
  attainmentPct: number,
  rules: VariablePayoutRules,
): number {
  const threshold = D.min(D.max(dec(rules.thresholdPct), 0), 100);
  const cappedAttainment = rules.capPct === null
    ? dec(attainmentPct)
    : D.min(dec(attainmentPct), D.max(dec(rules.capPct), 0));
  const attainment = D.max(cappedAttainment, 0);
  // Strictly below threshold pays nothing. At 100% (including threshold === 100)
  // fall through to the full-payout branch.
  if (attainment.lt(threshold) || targetVariable <= 0) return 0;

  if (attainment.lte(100)) {
    const span = dec(100).minus(threshold);
    return span.isZero()
      ? money(targetVariable)
      : money(dec(targetVariable).mul(attainment.minus(threshold).div(span)));
  }

  const accelerated = attainment.minus(100).div(100).mul(D.max(dec(rules.accelerator), 0));
  return money(dec(targetVariable).mul(dec(1).plus(accelerated)));
}

export function calculateMemberValues(member: TeamMember): DerivedMemberValues {
  const base = dec(member.base);
  const variable = dec(member.targetVariable);
  const ote = base.plus(variable);
  const basePct = ote.isZero() ? 0 : money(base.div(ote).mul(100));
  const variablePct = ote.isZero() ? 0 : money(variable.div(ote).mul(100));

  const isMonthly = member.payPeriod === "monthly";
  const monthlyBase = isMonthly ? member.base : money(base.div(12));
  const monthlyOte = isMonthly ? money(ote) : money(ote.div(12));
  const monthlyVariable = isMonthly ? member.targetVariable : money(variable.div(12));

  const annualBase = isMonthly ? money(base.mul(12)) : member.base;
  const annualOte = isMonthly ? money(ote.mul(12)) : money(ote);
  const annualVariable = isMonthly ? money(variable.mul(12)) : member.targetVariable;

  let monthlyQuota: number;
  let annualQuota: number;

  if (member.quotaMode === "direct") {
    const directQuota = dec(member.directQuota ?? 0);
    monthlyQuota = isMonthly ? money(directQuota) : money(directQuota.div(12));
    annualQuota = isMonthly ? money(directQuota.mul(12)) : money(directQuota);
  } else {
    const quotaForPayPeriod = ote.mul(member.quotaMultiple ?? 0);
    monthlyQuota = isMonthly ? money(quotaForPayPeriod) : money(quotaForPayPeriod.div(12));
    annualQuota = isMonthly ? money(quotaForPayPeriod.mul(12)) : money(quotaForPayPeriod);
  }

  return {
    memberId: member.id,
    variable: money(variable),
    basePct,
    variablePct,
    monthlyBase,
    monthlyOte,
    monthlyVariable,
    annualBase,
    annualOte,
    annualVariable,
    monthlyQuota,
    annualQuota,
    quotaCurrency: member.currency,
    aggregateMonthlyQuota: 0,
    aggregateAnnualQuota: 0,
    aggregateQuotaCurrency: member.currency,
    isHierarchyRoot: false,
  };
}

export function convertCurrency(amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode, fxRates: Record<string, number>): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rateKey = `${fromCurrency}/${toCurrency}`;
  const rate = fxRates[rateKey];
  
  if (rate !== undefined) {
    return money(dec(amount).mul(rate));
  }
  
  const inverseKey = `${toCurrency}/${fromCurrency}`;
  const inverseRate = fxRates[inverseKey];
  
  if (inverseRate !== undefined && inverseRate !== 0) {
    return money(dec(amount).div(inverseRate));
  }
  
  return amount;
}

function buildHierarchy(team: TeamDefinition): {
  parentById: Map<string, string | null>;
  childrenById: Map<string, string[]>;
  rootIds: string[];
  cycleMemberIds: string[];
} {
  const ids = new Set(team.members.map((member) => member.id));
  const parentById = new Map<string, string | null>(
    team.members.map((member) => [
      member.id,
      member.reportsToMemberId && ids.has(member.reportsToMemberId) && member.reportsToMemberId !== member.id
        ? member.reportsToMemberId
        : null,
    ]),
  );
  const state = new Map<string, 0 | 1 | 2>();
  const cycleMemberIds = new Set<string>();

  const visit = (id: string, path: string[]): void => {
    state.set(id, 1);
    path.push(id);
    const parentId = parentById.get(id);
    if (parentId) {
      const parentState = state.get(parentId) ?? 0;
      if (parentState === 0) {
        visit(parentId, path);
      } else if (parentState === 1) {
        const cycleStart = path.indexOf(parentId);
        const cycle = path.slice(cycleStart);
        cycle.forEach((memberId) => cycleMemberIds.add(memberId));
        // Break one edge deterministically so every cyclic component still has a root.
        parentById.set(cycle[0], null);
      }
    }
    path.pop();
    state.set(id, 2);
  };

  for (const member of team.members) {
    if ((state.get(member.id) ?? 0) === 0) visit(member.id, []);
  }

  const childrenById = new Map(team.members.map((member) => [member.id, [] as string[]]));
  for (const [memberId, parentId] of parentById) {
    if (parentId) childrenById.get(parentId)?.push(memberId);
  }
  const rootIds = team.members
    .filter((member) => parentById.get(member.id) === null)
    .map((member) => member.id);

  return { parentById, childrenById, rootIds, cycleMemberIds: [...cycleMemberIds] };
}

export function calculateTeam(team: TeamDefinition, reportingCurrency: CurrencyCode): TeamCalculationResult {
  const members = team.members.map((member) =>
    {
      const derived = calculateMemberValues(member);
      derived.aggregateQuotaCurrency = reportingCurrency;
      return derived;
    },
  );
  const derivedById = new Map(members.map((member) => [member.memberId, member]));
  const memberById = new Map(team.members.map((member) => [member.id, member]));
  const hierarchy = buildHierarchy(team);

  const aggregateQuota = (memberId: string): { monthly: Decimal; annual: Decimal } => {
    const member = memberById.get(memberId);
    const derived = derivedById.get(memberId);
    if (!member || !derived) return { monthly: ZERO, annual: ZERO };
    let monthly = dec(convertCurrency(
      derived.monthlyQuota,
      member.currency,
      reportingCurrency,
      team.fxRates,
    ));
    let annual = dec(convertCurrency(
      derived.annualQuota,
      member.currency,
      reportingCurrency,
      team.fxRates,
    ));
    for (const childId of hierarchy.childrenById.get(memberId) ?? []) {
      const child = aggregateQuota(childId);
      monthly = monthly.plus(child.monthly);
      annual = annual.plus(child.annual);
    }
    derived.aggregateMonthlyQuota = money(monthly);
    derived.aggregateAnnualQuota = money(annual);
    derived.isHierarchyRoot = hierarchy.parentById.get(memberId) === null;
    return { monthly, annual };
  };

  let teamMonthlyQuotaDecimal = ZERO;
  let teamAnnualQuotaDecimal = ZERO;
  for (const rootId of hierarchy.rootIds) {
    const aggregate = aggregateQuota(rootId);
    teamMonthlyQuotaDecimal = teamMonthlyQuotaDecimal.plus(aggregate.monthly);
    teamAnnualQuotaDecimal = teamAnnualQuotaDecimal.plus(aggregate.annual);
  }

  let totalMonthlyBase = ZERO;
  let totalMonthlyOte = ZERO;
  let totalMonthlyVariable = ZERO;
  let totalAnnualBase = ZERO;
  let totalAnnualOte = ZERO;
  let totalAnnualVariable = ZERO;
  let totalMonthlyQuota = ZERO;
  let totalAnnualQuota = ZERO;

  for (let i = 0; i < team.members.length; i++) {
    const member = team.members[i];
    const derived = members[i];

    totalMonthlyBase = totalMonthlyBase.plus(convertCurrency(derived.monthlyBase, member.currency, reportingCurrency, team.fxRates));
    totalMonthlyOte = totalMonthlyOte.plus(convertCurrency(derived.monthlyOte, member.currency, reportingCurrency, team.fxRates));
    totalMonthlyVariable = totalMonthlyVariable.plus(convertCurrency(derived.monthlyVariable, member.currency, reportingCurrency, team.fxRates));
    totalAnnualBase = totalAnnualBase.plus(convertCurrency(derived.annualBase, member.currency, reportingCurrency, team.fxRates));
    totalAnnualOte = totalAnnualOte.plus(convertCurrency(derived.annualOte, member.currency, reportingCurrency, team.fxRates));
    totalAnnualVariable = totalAnnualVariable.plus(convertCurrency(derived.annualVariable, member.currency, reportingCurrency, team.fxRates));
    totalMonthlyQuota = totalMonthlyQuota.plus(convertCurrency(derived.monthlyQuota, member.currency, reportingCurrency, team.fxRates));
    totalAnnualQuota = totalAnnualQuota.plus(convertCurrency(derived.annualQuota, member.currency, reportingCurrency, team.fxRates));
  }

  const teamMonthlyQuota = money(teamMonthlyQuotaDecimal);
  const teamAnnualQuota = money(teamAnnualQuotaDecimal);

  const totals: TeamTotals = {
    reportingCurrency,
    totalMonthlyBase: money(totalMonthlyBase),
    totalMonthlyOte: money(totalMonthlyOte),
    totalMonthlyVariable: money(totalMonthlyVariable),
    totalAnnualBase: money(totalAnnualBase),
    totalAnnualOte: money(totalAnnualOte),
    totalAnnualVariable: money(totalAnnualVariable),
    totalMonthlyQuota: money(totalMonthlyQuota),
    totalAnnualQuota: money(totalAnnualQuota),
    teamMonthlyQuota,
    teamAnnualQuota,
  };

  return { team, members, totals, hierarchyCycleMemberIds: hierarchy.cycleMemberIds };
}

export function calculateTeamScenario(
  team: TeamDefinition,
  reportingCurrency: CurrencyCode,
  scenarioOrAttainment: TeamScenario | number,
): TeamScenarioResult {
  const calculation = calculateTeam(team, reportingCurrency);
  const uniformAttainment = typeof scenarioOrAttainment === "number" ? scenarioOrAttainment : null;
  const scenario: TeamScenario = typeof scenarioOrAttainment === "number"
    ? {
      id: `attainment-${scenarioOrAttainment}`,
      name: `${scenarioOrAttainment}%`,
      attainmentByMemberId: Object.fromEntries(
        team.members.map((member) => [member.id, scenarioOrAttainment]),
      ),
    }
    : scenarioOrAttainment;
  const hierarchy = buildHierarchy(team);
  const derivedById = new Map(calculation.members.map((member) => [member.memberId, member]));
  const descendantIds = (memberId: string): string[] => {
    const ids: string[] = [];
    const walk = (id: string) => {
      for (const childId of hierarchy.childrenById.get(id) ?? []) {
        ids.push(childId);
        walk(childId);
      }
    };
    walk(memberId);
    return ids;
  };

  const ownAnnualQuotaReporting = (memberId: string): Decimal => {
    const index = team.members.findIndex((member) => member.id === memberId);
    if (index < 0) return ZERO;
    const member = team.members[index];
    const derived = calculation.members[index];
    return dec(convertCurrency(derived.annualQuota, member.currency, reportingCurrency, team.fxRates));
  };

  const subtreeAttainmentPct = (memberId: string): number => {
    const derived = derivedById.get(memberId);
    if (!derived || derived.aggregateAnnualQuota === 0) return 0;
    const ids = [memberId, ...descendantIds(memberId)];
    const weighted = ids.reduce((sum, id) => {
      const entered = scenario.attainmentByMemberId[id] ?? 0;
      return sum.plus(ownAnnualQuotaReporting(id).mul(dec(entered).div(100)));
    }, ZERO);
    return money(weighted.div(derived.aggregateAnnualQuota).mul(100));
  };

  const members: MemberScenarioResult[] = team.members.map((member, index) => {
    const derived = calculation.members[index];
    const enteredAttainment = scenario.attainmentByMemberId[member.id] ?? 0;
    const memberAttainment = member.payoutBasis === "team"
      ? subtreeAttainmentPct(member.id)
      : enteredAttainment;
    const variablePayout = calculateVariablePayout(
      derived.monthlyVariable,
      memberAttainment,
      resolvePayoutRules(member, team),
    );
    return {
      memberId: member.id,
      currency: member.currency,
      ownAttainmentPct: enteredAttainment,
      attainmentPct: memberAttainment,
      payoutBasis: member.payoutBasis,
      base: derived.monthlyBase,
      variablePayout,
      total: money(dec(derived.monthlyBase).plus(variablePayout)),
    };
  });

  const totalCost = money(members.reduce((sum, memberScenario, index) => sum.plus(
    convertCurrency(memberScenario.total, team.members[index].currency, reportingCurrency, team.fxRates),
  ), ZERO));
  const generatedArr = money(team.members.reduce((sum, member, index) => {
    const entered = scenario.attainmentByMemberId[member.id] ?? 0;
    const annualQuota = convertCurrency(
      calculation.members[index].annualQuota,
      member.currency,
      reportingCurrency,
      team.fxRates,
    );
    return sum.plus(dec(annualQuota).mul(dec(entered).div(100)));
  }, ZERO));
  const annualizedCost = dec(totalCost).mul(12);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    attainmentPct: uniformAttainment,
    members,
    totalCost,
    generatedArr,
    arrCostRatio: annualizedCost.isZero()
      ? null
      : dec(generatedArr).div(annualizedCost).toDecimalPlaces(2).toNumber(),
    reportingCurrency,
  };
}

export function calculateAttainmentScenarios(
  team: TeamDefinition,
  reportingCurrency: CurrencyCode,
  startPct: number,
  endPct: number,
  stepPct: number,
): TeamScenarioResult[] {
  const start = Math.max(0, startPct);
  const end = Math.max(start, endPct);
  const step = Math.max(1, stepPct);
  const values: number[] = [];
  let current = dec(start);
  const endDec = dec(end);
  const stepDec = dec(step);
  while (current.lt(endDec) && values.length < 201) {
    values.push(money(current));
    current = current.plus(stepDec);
  }
  const endValue = money(endDec);
  if (values.length === 0 || values[values.length - 1] !== endValue) {
    if (values.length < 201) values.push(endValue);
  }
  return values.map((attainmentPct) => calculateTeamScenario(team, reportingCurrency, attainmentPct));
}

function quotaForArrPayout(
  member: TeamMember,
  derived: DerivedMemberValues,
  period: ArrPeriod,
): { amount: number; currency: CurrencyCode } {
  if (member.payoutBasis === "team") {
    return {
      amount: period === "monthly" ? derived.aggregateMonthlyQuota : derived.aggregateAnnualQuota,
      currency: derived.aggregateQuotaCurrency,
    };
  }
  return {
    amount: period === "monthly" ? derived.monthlyQuota : derived.annualQuota,
    currency: member.currency,
  };
}

function compensationForPeriod(derived: DerivedMemberValues, period: ArrPeriod): { base: number; targetVariable: number } {
  return period === "monthly"
    ? { base: derived.monthlyBase, targetVariable: derived.monthlyVariable }
    : { base: derived.annualBase, targetVariable: derived.annualVariable };
}

const ARR_BREAKPOINT_PCTS = [0, 75, 100, 120, 150];

export function calculateMarginalRate(
  targetVariable: number,
  quota: number,
  attainmentPct: number,
  rules: VariablePayoutRules,
): number {
  if (quota <= 0 || targetVariable <= 0) return 0;
  const threshold = D.min(D.max(dec(rules.thresholdPct), 0), 100);
  const cap = rules.capPct === null ? null : D.max(dec(rules.capPct), 0);
  const attainment = dec(attainmentPct);
  if (cap !== null && attainment.gte(cap)) return 0;
  if (attainment.lt(threshold)) return 0;
  if (attainment.lt(100)) {
    const span = dec(100).minus(threshold);
    if (span.lte(0)) return 0;
    return dec(targetVariable).mul(100).div(dec(quota).mul(span)).toDecimalPlaces(4, D.ROUND_HALF_UP).toNumber();
  }
  return dec(targetVariable).mul(D.max(dec(rules.accelerator), 0)).div(quota).toDecimalPlaces(4, D.ROUND_HALF_UP).toNumber();
}

export function calculateArrPayout(
  team: TeamDefinition,
  reportingCurrency: CurrencyCode,
  memberId: string,
  arrAmount: number,
  arrCurrency: CurrencyCode,
  period: ArrPeriod,
): ArrPayoutResult | null {
  const calculation = calculateTeam(team, reportingCurrency);
  const index = team.members.findIndex((member) => member.id === memberId);
  if (index < 0) return null;
  const member = team.members[index];
  const derived = calculation.members[index];
  const rules = resolvePayoutRules(member, team);
  const quota = quotaForArrPayout(member, derived, period);
  const { base, targetVariable } = compensationForPeriod(derived, period);
  const arrInQuotaCurrency = convertCurrency(Math.max(arrAmount, 0), arrCurrency, quota.currency, team.fxRates);
  const attainmentPct = quota.amount <= 0 ? 0 : money(dec(arrInQuotaCurrency).div(quota.amount).mul(100));
  const variablePayout = calculateVariablePayout(targetVariable, attainmentPct, rules);
  const payoutInArrCurrency = convertCurrency(variablePayout, member.currency, arrCurrency, team.fxRates);
  const quotaInMemberCurrency = convertCurrency(quota.amount, quota.currency, member.currency, team.fxRates);

  return {
    memberId: member.id,
    period,
    arrAmount: money(Math.max(arrAmount, 0)),
    arrCurrency,
    quota: quota.amount,
    quotaCurrency: quota.currency,
    attainmentPct,
    base,
    variablePayout,
    total: money(dec(base).plus(variablePayout)),
    payoutCurrency: member.currency,
    effectiveRate: arrAmount <= 0
      ? null
      : dec(payoutInArrCurrency).div(arrAmount).toDecimalPlaces(4, D.ROUND_HALF_UP).toNumber(),
    marginalRate: quotaInMemberCurrency <= 0
      ? null
      : calculateMarginalRate(targetVariable, quotaInMemberCurrency, attainmentPct, rules),
  };
}

export function calculateArrPayoutSchedule(
  team: TeamDefinition,
  reportingCurrency: CurrencyCode,
  memberId: string,
  period: ArrPeriod,
  arrCurrency: CurrencyCode,
  rangeStart: number,
  rangeEnd: number,
  step: number,
): ArrPayoutResult[] {
  const sample = calculateArrPayout(team, reportingCurrency, memberId, 0, arrCurrency, period);
  if (!sample) return [];
  const quotaInArr = convertCurrency(sample.quota, sample.quotaCurrency, arrCurrency, team.fxRates);
  const member = team.members.find((item) => item.id === memberId);
  const rules = member ? resolvePayoutRules(member, team) : { thresholdPct: 0, accelerator: 1, capPct: null };
  const start = Math.max(0, rangeStart);
  const end = Math.max(start, rangeEnd);
  const stepSize = Math.max(0, step);
  const amounts: number[] = [];
  if (stepSize > 0) {
    let current = dec(start);
    const endDec = dec(end);
    const stepDec = dec(stepSize);
    while (current.lt(endDec) && amounts.length < 201) {
      amounts.push(money(current));
      current = current.plus(stepDec);
    }
  }
  const endValue = money(end);
  if (amounts.length === 0 || amounts[amounts.length - 1] !== endValue) {
    if (amounts.length < 201) amounts.push(endValue);
  }
  const breakpointPcts = [...ARR_BREAKPOINT_PCTS, rules.thresholdPct, rules.capPct]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  for (const pctValue of breakpointPcts) {
    const amount = money(dec(quotaInArr).mul(pctValue).div(100));
    if (amount >= start && amount <= end) amounts.push(amount);
  }
  const unique = [...new Set(amounts)].sort((a, b) => a - b).slice(0, 201);
  return unique.flatMap((amount) => {
    const row = calculateArrPayout(team, reportingCurrency, memberId, amount, arrCurrency, period);
    return row ? [row] : [];
  });
}

export function calculateArrPayoutComparison(
  team: TeamDefinition,
  reportingCurrency: CurrencyCode,
  arrAmount: number,
  period: ArrPeriod,
): ArrPayoutResult[] {
  return team.members
    .filter((member) => member.payoutBasis === "individual")
    .flatMap((member) => {
      const row = calculateArrPayout(team, reportingCurrency, member.id, arrAmount, reportingCurrency, period);
      return row ? [row] : [];
    });
}
