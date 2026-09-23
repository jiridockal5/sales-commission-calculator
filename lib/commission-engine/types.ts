/**
 * Commission plan data model.
 *
 * All entities are plain, serializable objects with string ids and parent references
 * (`planId`) so they map 1:1 onto relational tables later. Monetary values are stored
 * as numbers in major currency units; percentages are stored as percent numbers
 * (10 = 10%). The engine converts everything to Decimal before doing arithmetic.
 */

export const SCHEMA_VERSION = 1 as const;

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CZK";
export type PeriodType = "monthly" | "quarterly" | "half_year" | "annual";
export type CalculationMode = "single" | "multi";
export type ConfigMode = "simple" | "advanced";
export type AccelerationMethod = "marginal" | "retroactive";
export type PrimaryMetric = "arr" | "revenue" | "bookings";
export type QuotaScope = "individual" | "team";

export type RevenueTypeKey =
  | "new_arr"
  | "new_mrr"
  | "acv"
  | "tcv"
  | "one_time"
  | "expansion"
  | "upsell"
  | "cross_sell"
  | "renewal";

export interface Period {
  id: string;
  planId: string;
  periodType: PeriodType;
  /** 0-based position within the fiscal year. */
  index: number;
  label: string;
  /** 0-based month offset within the fiscal year where the period starts. */
  startMonth: number;
  months: number;
}

export interface RevenueType {
  id: string;
  planId: string;
  key: RevenueTypeKey;
  label: string;
  enabled: boolean;
  /**
   * Quota-based types are measured against a quota and run through tiers.
   * Non-quota types (e.g. renewals) pay a flat rate on credited revenue and sit
   * outside the main quota structure.
   */
  quotaBased: boolean;
  /** Credit weighting in percent: share of actual revenue credited (attainment + commission). */
  weighting: number;
  sortOrder: number;
}

export interface CommissionTier {
  id: string;
  /** Lower bound in quota attainment percent (inclusive). */
  fromPct: number;
  /** Upper bound in quota attainment percent (exclusive). null = unbounded. */
  toPct: number | null;
  /** Commission rate in percent. */
  rate: number;
}

export interface CommissionRule {
  id: string;
  planId: string;
  revenueTypeId: string;
  accelerationMethod: AccelerationMethod;
  /** Simple mode: rate applied up to the accelerator start. Also the flat rate for non-quota types. */
  baseRate: number;
  /** Simple mode: attainment percent where the accelerator starts. */
  acceleratorFromPct: number;
  /** Simple mode: rate above acceleratorFromPct. */
  acceleratorRate: number;
  /** Advanced mode tiers. */
  tiers: CommissionTier[];
  /** Minimum attainment percent before any commission is paid (requires features.threshold). */
  thresholdPct: number;
  /** Maximum commission per period for this revenue type (requires features.caps). */
  maxPayoutPerPeriod: number | null;
  /** Maximum attainment percent counted for commission (requires features.caps). */
  maxAttainmentPct: number | null;
  /** Renewals: only revenue renewed within the period is commissionable. */
  requireInPeriod: boolean;
}

export interface Quota {
  id: string;
  planId: string;
  periodId: string;
  revenueTypeId: string;
  scope: QuotaScope;
  amount: number;
}

export interface PerformanceData {
  id: string;
  planId: string;
  periodId: string;
  revenueTypeId: string;
  scope: QuotaScope;
  actual: number;
  /** Revenue excluded from commission (e.g. renewals booked outside the period). */
  excludedAmount: number;
}

export interface RampStep {
  id: string;
  /** Tenure period number (1 = first period of employment). */
  periodNumber: number;
  /** Percent of full quota. */
  pct: number;
}

export interface RampSchedule {
  /** Tenure period number of the plan's first period (1 = rep starts in the first period). */
  firstPeriodNumber: number;
  steps: RampStep[];
}

export interface TeamConfig {
  /** Percent of variable compensation driven by individual performance. */
  individualWeight: number;
  /** Percent of variable compensation driven by team performance. */
  teamWeight: number;
}

export interface CapConfig {
  /** Maximum total commission across all modeled periods (null = uncapped). */
  maxTotalPayout: number | null;
}

export type BonusEvaluation = "per_period" | "annual";

export interface BonusRule {
  id: string;
  planId: string;
  /** Attainment percent at which the bonus is earned (inclusive). */
  attainmentPct: number;
  /** Fixed bonus amount. Milestones stack: each milestone reached pays its amount. */
  amount: number;
}

export type ClawbackTrigger = "churn" | "non_payment" | "cancellation";

export interface ClawbackRule {
  id: string;
  planId: string;
  trigger: ClawbackTrigger;
  withinDays: number;
  /** Percent of original commission clawed back. */
  pct: number;
}

/** Aggregated clawback adjustment entered for a period. */
export interface ClawbackEntry {
  id: string;
  planId: string;
  periodId: string;
  /** Rule used to compute the clawback; null = amount is clawed back 100%. */
  clawbackRuleId: string | null;
  /** Original commission on the affected deals. */
  commissionAmount: number;
  note: string;
}

export type DrawType = "recoverable" | "non_recoverable";

export interface DrawRule {
  type: DrawType;
  amountPerPeriod: number;
}

export type GuaranteeScope = "all_periods" | "ramp_periods";

export interface GuaranteeRule {
  amountPerPeriod: number;
  appliesTo: GuaranteeScope;
}

export interface SplitRule {
  id: string;
  planId: string;
  role: string;
  pct: number;
}

export interface OTEConfig {
  /** Annual base salary. */
  baseSalary: number;
  /** Annual target variable compensation. */
  targetVariable: number;
  /** Employer payroll taxes / benefits as percent of total cash compensation. */
  employerOverheadPct: number;
}

export interface FeatureToggles {
  accelerators: boolean;
  threshold: boolean;
  caps: boolean;
  bonuses: boolean;
  team: boolean;
  ramp: boolean;
  clawbacks: boolean;
  draw: boolean;
  guarantee: boolean;
  splits: boolean;
}

export interface CommissionPlan {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  description: string;
  currency: CurrencyCode;
  calculationPeriod: PeriodType;
  mode: CalculationMode;
  /** Period used in single-period mode. */
  singlePeriodIndex: number;
  payoutFrequency: PeriodType;
  configMode: ConfigMode;
  primaryMetric: PrimaryMetric;
  features: FeatureToggles;
  periods: Period[];
  revenueTypes: RevenueType[];
  rules: CommissionRule[];
  quotas: Quota[];
  performance: PerformanceData[];
  ramp: RampSchedule;
  team: TeamConfig;
  cap: CapConfig;
  bonusEvaluation: BonusEvaluation;
  bonuses: BonusRule[];
  clawbackRules: ClawbackRule[];
  clawbackEntries: ClawbackEntry[];
  draw: DrawRule;
  guarantee: GuaranteeRule;
  splits: SplitRule[];
  ote: OTEConfig;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface TierBreakdownLine {
  tierId: string;
  label: string;
  fromPct: number;
  toPct: number | null;
  rate: number;
  revenueInTier: number;
  commission: number;
}

export interface RevenueTypeResult {
  revenueTypeId: string;
  key: RevenueTypeKey;
  label: string;
  quotaBased: boolean;
  fullQuota: number;
  quota: number;
  actual: number;
  credited: number;
  /** Credited revenue actually used for commission after max-attainment cap. */
  commissionable: number;
  attainmentPct: number | null;
  belowThreshold: boolean;
  method: AccelerationMethod | "flat";
  tierLines: TierBreakdownLine[];
  grossCommission: number;
  capReduction: number;
  /** Commission after per-type cap and individual weighting. */
  commission: number;
}

export interface TeamResult {
  quota: number;
  actual: number;
  attainmentPct: number | null;
  payoutFactor: number;
  targetVariable: number;
  commission: number;
}

export interface BonusResult {
  bonusRuleId: string;
  attainmentPct: number;
  amount: number;
}

export interface DrawLedgerEntry {
  drawAmount: number;
  /** Payout portion not covered by earnings (advanced by the company). */
  advance: number;
  /** Amount recovered from earnings against an outstanding balance. */
  recovery: number;
  /** Shortfall forgiven (non-recoverable draw). */
  forgiven: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface PeriodResult {
  periodId: string;
  label: string;
  index: number;
  rampPct: number;
  isRampPeriod: boolean;
  fullQuota: number;
  quota: number;
  actual: number;
  commissionableRevenue: number;
  attainmentPct: number | null;
  revenueTypes: RevenueTypeResult[];
  team: TeamResult | null;
  individualCommission: number;
  teamCommission: number;
  planCapReduction: number;
  commission: number;
  bonuses: BonusResult[];
  bonusTotal: number;
  earned: number;
  guaranteeTopUp: number;
  clawback: number;
  netEarned: number;
  draw: DrawLedgerEntry;
  payout: number;
  targetVariable: number;
  baseSalary: number;
}

export interface PayoutGroup {
  label: string;
  periodIds: string[];
  payout: number;
}

export interface SplitResultLine {
  splitRuleId: string;
  role: string;
  pct: number;
  amount: number;
}

export interface SplitResult {
  valid: boolean;
  totalPct: number;
  pool: number;
  lines: SplitResultLine[];
}

export interface EmployerCost {
  baseSalary: number;
  commission: number;
  bonuses: number;
  guarantee: number;
  drawAdvances: number;
  drawRecoveries: number;
  clawbacks: number;
  totalCashCompensation: number;
  overhead: number;
  totalCost: number;
  commissionPctOfRevenue: number | null;
  totalCostPctOfRevenue: number | null;
}

export interface OTEScenario {
  attainmentPct: number;
  variable: number;
  totalCompensation: number;
  pctOfTargetVariable: number | null;
}

export interface OTEResult {
  baseSalary: number;
  targetVariable: number;
  ote: number;
  variablePct: number | null;
  scenarios: OTEScenario[];
}

export interface PayoutCurvePoint {
  attainmentPct: number;
  payout: number;
}

export interface NamedAmount {
  id: string;
  label: string;
  amount: number;
}

export interface CalculationTotals {
  fullQuota: number;
  quota: number;
  actual: number;
  commissionableRevenue: number;
  attainmentPct: number | null;
  commission: number;
  individualCommission: number;
  teamCommission: number;
  planCapReduction: number;
  bonuses: number;
  guarantee: number;
  clawbacks: number;
  drawAdvances: number;
  drawRecoveries: number;
  drawForgiven: number;
  drawBalance: number;
  earnedVariable: number;
  payout: number;
  baseSalary: number;
  targetVariable: number;
  ote: number;
  variableAttainmentPct: number | null;
  oteAttainmentPct: number | null;
  effectiveRatePct: number | null;
}

export interface CalculationResult {
  planId: string;
  periods: PeriodResult[];
  totals: CalculationTotals;
  byRevenueType: NamedAmount[];
  byTier: NamedAmount[];
  payouts: PayoutGroup[];
  splits: SplitResult | null;
  employerCost: EmployerCost;
  warnings: string[];
}

export interface PlanComparisonEntry {
  planId: string;
  planName: string;
  currency: CurrencyCode;
  totalCommission: number;
  totalCompensation: number;
  effectiveRatePct: number | null;
  attainmentPct: number | null;
  employerCost: number;
  commissionPctOfRevenue: number | null;
  byPeriod: NamedAmount[];
  byRevenueType: NamedAmount[];
  payoutCurve: PayoutCurvePoint[];
}

export interface PlanComparisonResult {
  entries: PlanComparisonEntry[];
  periodLabels: string[];
  revenueTypeLabels: string[];
  /** Merged payout curves keyed by attainment: { attainmentPct, [planId]: payout }. */
  payoutCurves: Array<Record<string, number>>;
}
