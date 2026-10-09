/**
 * Sales team data model.
 */

import type { CurrencyCode as CurrencyCodeType } from "@/lib/commission-engine/types";

export type CurrencyCode = CurrencyCodeType;
export type TeamMemberRole = "AE" | "SDR" | "AM" | "Head of Sales" | "Manager" | "Other";
export type PayPeriodType = "monthly" | "annual";
export type QuotaMode = "multiple" | "direct";
export type PayoutBasis = "individual" | "team";

export interface VariablePayoutRules {
  thresholdPct: number;
  accelerator: number;
  capPct: number | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  currency: CurrencyCode;
  payPeriod: PayPeriodType;
  base: number;
  /** Target variable compensation in the member's currency and pay period. */
  targetVariable: number;
  quotaMode: QuotaMode;
  /** Used when quotaMode is "multiple". */
  quotaMultiple?: number;
  /** Used when quotaMode is "direct", in the member's pay period. */
  directQuota?: number;
  reportsToMemberId: string | null;
  payoutBasis: PayoutBasis;
  /** Undefined inherits the corresponding team default. */
  thresholdPct?: number;
  /** Undefined inherits the corresponding team default. */
  accelerator?: number;
  /** Undefined inherits the team default; null explicitly means uncapped. */
  capPct?: number | null;
}

export interface TeamScenario {
  id: string;
  name: string;
  attainmentByMemberId: Record<string, number>;
}

export interface TeamDefinition {
  id: string;
  name: string;
  defaultQuotaMultiple: number;
  defaultThresholdPct: number;
  defaultAccelerator: number;
  defaultCapPct: number | null;
  fxRates: Record<string, number>;
  members: TeamMember[];
  scenarios: TeamScenario[];
  createdAt: string;
  updatedAt: string;
}

export interface DerivedMemberValues {
  memberId: string;
  variable: number;
  basePct: number;
  variablePct: number;
  monthlyBase: number;
  monthlyOte: number;
  monthlyVariable: number;
  annualBase: number;
  annualOte: number;
  annualVariable: number;
  monthlyQuota: number;
  annualQuota: number;
  quotaCurrency: CurrencyCode;
  /** Own quota plus all descendants, converted to the reporting currency. */
  aggregateMonthlyQuota: number;
  /** Own quota plus all descendants, converted to the reporting currency. */
  aggregateAnnualQuota: number;
  aggregateQuotaCurrency: CurrencyCode;
  isHierarchyRoot: boolean;
}

export interface TeamTotals {
  reportingCurrency: CurrencyCode;
  totalMonthlyBase: number;
  totalMonthlyOte: number;
  totalMonthlyVariable: number;
  totalAnnualBase: number;
  totalAnnualOte: number;
  totalAnnualVariable: number;
  totalMonthlyQuota: number;
  totalAnnualQuota: number;
  teamMonthlyQuota: number;
  teamAnnualQuota: number;
}

export interface TeamCalculationResult {
  team: TeamDefinition;
  members: DerivedMemberValues[];
  totals: TeamTotals;
  /** Members whose reporting links formed a cycle before calculation broke it safely. */
  hierarchyCycleMemberIds: string[];
}

export interface MemberScenarioResult {
  memberId: string;
  currency: CurrencyCode;
  /** Own-quota attainment entered for the scenario. */
  ownAttainmentPct: number;
  /** Attainment used for payout (subtree for team basis). */
  attainmentPct: number;
  payoutBasis: PayoutBasis;
  /** Monthly values in the member's currency. */
  base: number;
  variablePayout: number;
  total: number;
}

export interface TeamScenarioResult {
  scenarioId: string;
  scenarioName: string;
  /** Retained for uniform-attainment generated scenarios; named scenarios use null. */
  attainmentPct: number | null;
  members: MemberScenarioResult[];
  /** Monthly team cost in reporting currency. */
  totalCost: number;
  /** Annual ARR in reporting currency. */
  generatedArr: number;
  arrCostRatio: number | null;
  reportingCurrency: CurrencyCode;
}

export type ArrPeriod = "monthly" | "annual";

export interface ArrPayoutResult {
  memberId: string;
  period: ArrPeriod;
  arrAmount: number;
  arrCurrency: CurrencyCode;
  quota: number;
  quotaCurrency: CurrencyCode;
  attainmentPct: number;
  base: number;
  variablePayout: number;
  total: number;
  payoutCurrency: CurrencyCode;
  /** Variable payout in ARR currency divided by ARR. */
  effectiveRate: number | null;
  /** Variable payout from the next ARR unit in the current band. */
  marginalRate: number | null;
}
