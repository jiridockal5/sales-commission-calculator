/**
 * Sales team data model.
 */

import type { CurrencyCode as CurrencyCodeType } from "@/lib/commission-engine/types";

export type CurrencyCode = CurrencyCodeType;
export type TeamMemberRole = "AE" | "SDR" | "AM" | "Head of Sales" | "Manager" | "Other";
export type PayPeriodType = "monthly" | "annual";
export type QuotaType = "individual" | "team";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  currency: CurrencyCode;
  payPeriod: PayPeriodType;
  base: number;
  ote: number;
  quotaType: QuotaType;
  quotaMultiple: number;
}

export interface TeamDefinition {
  id: string;
  name: string;
  defaultQuotaMultiple: number;
  fxRates: Record<string, number>;
  members: TeamMember[];
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
}
