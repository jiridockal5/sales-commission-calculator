import { dec, money, D } from "@/lib/commission-engine/money";
import type {
  TeamDefinition,
  TeamMember,
  DerivedMemberValues,
  TeamTotals,
  TeamCalculationResult,
  CurrencyCode,
} from "./types";

const ZERO = new D(0);

export function calculateMemberValues(member: TeamMember, teamOteMonthly: number): DerivedMemberValues {
  const base = dec(member.base);
  const ote = dec(member.ote);
  const variable = ote.minus(base);
  const basePct = ote.isZero() ? 0 : money(base.div(ote).mul(100));
  const variablePct = ote.isZero() ? 0 : money(variable.div(ote).mul(100));

  const isMonthly = member.payPeriod === "monthly";
  const monthlyBase = isMonthly ? member.base : money(base.div(12));
  const monthlyOte = isMonthly ? member.ote : money(ote.div(12));
  const monthlyVariable = monthlyOte - monthlyBase;

  const annualBase = isMonthly ? money(base.mul(12)) : member.base;
  const annualOte = isMonthly ? money(ote.mul(12)) : member.ote;
  const annualVariable = annualOte - annualBase;

  let monthlyQuota: number;
  let annualQuota: number;

  if (member.quotaType === "team") {
    monthlyQuota = money(dec(teamOteMonthly).mul(member.quotaMultiple));
    annualQuota = money(dec(monthlyQuota).mul(12));
  } else {
    monthlyQuota = money(dec(monthlyVariable).mul(member.quotaMultiple));
    annualQuota = money(dec(annualVariable).mul(member.quotaMultiple));
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

export function calculateTeam(team: TeamDefinition, reportingCurrency: CurrencyCode): TeamCalculationResult {
  const teamOteMonthly = team.members.reduce((sum, member) => {
    const ote = dec(member.ote);
    const monthlyOte = member.payPeriod === "monthly" ? ote : ote.div(12);
    return sum.plus(monthlyOte);
  }, ZERO);

  const members = team.members.map((member) => calculateMemberValues(member, money(teamOteMonthly)));

  let totalMonthlyBase = 0;
  let totalMonthlyOte = 0;
  let totalMonthlyVariable = 0;
  let totalAnnualBase = 0;
  let totalAnnualOte = 0;
  let totalAnnualVariable = 0;
  let totalMonthlyQuota = 0;
  let totalAnnualQuota = 0;

  for (let i = 0; i < team.members.length; i++) {
    const member = team.members[i];
    const derived = members[i];

    totalMonthlyBase += convertCurrency(derived.monthlyBase, member.currency, reportingCurrency, team.fxRates);
    totalMonthlyOte += convertCurrency(derived.monthlyOte, member.currency, reportingCurrency, team.fxRates);
    totalMonthlyVariable += convertCurrency(derived.monthlyVariable, member.currency, reportingCurrency, team.fxRates);
    totalAnnualBase += convertCurrency(derived.annualBase, member.currency, reportingCurrency, team.fxRates);
    totalAnnualOte += convertCurrency(derived.annualOte, member.currency, reportingCurrency, team.fxRates);
    totalAnnualVariable += convertCurrency(derived.annualVariable, member.currency, reportingCurrency, team.fxRates);
    totalMonthlyQuota += convertCurrency(derived.monthlyQuota, member.currency, reportingCurrency, team.fxRates);
    totalAnnualQuota += convertCurrency(derived.annualQuota, member.currency, reportingCurrency, team.fxRates);
  }

  const teamMonthlyQuota = money(teamOteMonthly.mul(team.defaultQuotaMultiple));
  const teamAnnualQuota = money(dec(teamMonthlyQuota).mul(12));

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

  return { team, members, totals };
}
