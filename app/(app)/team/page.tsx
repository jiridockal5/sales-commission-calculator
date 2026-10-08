"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload, Eye, DollarSign } from "lucide-react";
import { Button, Field, Select, TextInput, NumberInput } from "@/components/ui/controls";
import { Alert, Card, PageHeader } from "@/components/ui/layout";
import { useTeamStore, useActiveTeam } from "@/store/teamStore";
import { calculateAttainmentScenarios, calculateTeam, calculateTeamScenario, resolvePayoutRules } from "@/lib/team/calculations";
import { serializeTeam, deserializeTeam } from "@/lib/team/export";
import { formatCurrency } from "@/lib/format/currency";
import type {
  CurrencyCode,
  TeamMemberRole,
  PayPeriodType,
  PayoutBasis,
  QuotaMode,
  TeamScenarioResult,
} from "@/lib/team/types";
import { CURRENCIES } from "@/lib/format/currency";

const ROLE_OPTIONS: { value: TeamMemberRole; label: string }[] = [
  { value: "AE", label: "Account Executive" },
  { value: "SDR", label: "SDR" },
  { value: "AM", label: "Account Manager" },
  { value: "Head of Sales", label: "Head of Sales" },
  { value: "Manager", label: "Manager" },
  { value: "Other", label: "Other" },
];

const PAY_PERIOD_OPTIONS: { value: PayPeriodType; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

const QUOTA_TYPE_OPTIONS: { value: PayoutBasis; label: string }[] = [
  { value: "individual", label: "Individual attainment" },
  { value: "team", label: "Team / subtree attainment" },
];

const QUOTA_MODE_OPTIONS: { value: QuotaMode; label: string }[] = [
  { value: "multiple", label: "OTE multiple" },
  { value: "direct", label: "Direct quota" },
];

function formatArrCostRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${ratio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;
}

function ScenarioResultsTable({
  scenarios,
  members,
  reportingCurrency,
}: {
  scenarios: TeamScenarioResult[];
  members: Array<{ id: string; name: string; currency: CurrencyCode }>;
  reportingCurrency: CurrencyCode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-2 py-2">Scenario</th>
            {members.map((member) => (
              <th key={member.id} className="px-2 py-2">{member.name} ({member.currency})</th>
            ))}
            <th className="px-2 py-2">Monthly Cost ({reportingCurrency})</th>
            <th className="px-2 py-2">Annual ARR ({reportingCurrency})</th>
            <th className="px-2 py-2">ARR / Annualized Cost</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario) => (
            <tr key={scenario.scenarioId} className="border-b border-slate-100 align-top">
              <td className="px-2 py-2 font-semibold">{scenario.scenarioName}</td>
              {scenario.members.map((memberScenario) => (
                <td key={memberScenario.memberId} className="px-2 py-2">
                  {memberScenario.payoutBasis === "team" && (
                    <div>Team attainment: {memberScenario.attainmentPct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%</div>
                  )}
                  <div>Monthly base: {formatCurrency(memberScenario.base, memberScenario.currency)}</div>
                  <div>Variable payout: {formatCurrency(memberScenario.variablePayout, memberScenario.currency)}</div>
                  <div className="font-medium">Monthly total: {formatCurrency(memberScenario.total, memberScenario.currency)}</div>
                </td>
              ))}
              <td className="px-2 py-2 font-medium">{formatCurrency(scenario.totalCost, reportingCurrency)}</td>
              <td className="px-2 py-2 font-medium">{formatCurrency(scenario.generatedArr, reportingCurrency)}</td>
              <td className="px-2 py-2">{formatArrCostRatio(scenario.arrCostRatio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function canReportTo(
  memberId: string,
  managerId: string,
  members: Array<{ id: string; reportsToMemberId: string | null }>,
): boolean {
  if (memberId === managerId) return false;
  const byId = new Map(members.map((member) => [member.id, member]));
  const visited = new Set<string>();
  let currentId: string | null = managerId;
  while (currentId) {
    if (currentId === memberId || visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = byId.get(currentId)?.reportsToMemberId ?? null;
  }
  return true;
}

export default function TeamPage() {
  const hydrated = useTeamStore((s) => s.hydrated);
  const hydrate = useTeamStore((s) => s.hydrate);
  const team = useActiveTeam();
  const addMember = useTeamStore((s) => s.addMember);
  const updateMember = useTeamStore((s) => s.updateMember);
  const deleteMember = useTeamStore((s) => s.deleteMember);
  const updateFxRates = useTeamStore((s) => s.updateFxRates);
  const updateDefaultQuotaMultiple = useTeamStore((s) => s.updateDefaultQuotaMultiple);
  const updateActiveTeam = useTeamStore((s) => s.updateActiveTeam);
  const importTeam = useTeamStore((s) => s.importTeam);
  const addScenario = useTeamStore((s) => s.addScenario);
  const renameScenario = useTeamStore((s) => s.renameScenario);
  const deleteScenario = useTeamStore((s) => s.deleteScenario);
  const setScenarioAttainment = useTeamStore((s) => s.setScenarioAttainment);

  const [reportingCurrency, setReportingCurrency] = useState<CurrencyCode>("CZK");
  const [showJson, setShowJson] = useState(false);
  const [jsonContent, setJsonContent] = useState("");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [rangeStartPct, setRangeStartPct] = useState(0);
  const [rangeEndPct, setRangeEndPct] = useState(200);
  const [rangeStepPct, setRangeStepPct] = useState(10);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const result = useMemo(() => {
    if (!team) return null;
    return calculateTeam(team, reportingCurrency);
  }, [team, reportingCurrency]);
  const scenarioResults = useMemo(() => {
    if (!team) return [];
    return team.scenarios.map((scenario) => calculateTeamScenario(team, reportingCurrency, scenario));
  }, [team, reportingCurrency]);
  const rangeResults = useMemo(() => {
    if (!team) return [];
    return calculateAttainmentScenarios(team, reportingCurrency, rangeStartPct, rangeEndPct, rangeStepPct);
  }, [team, reportingCurrency, rangeStartPct, rangeEndPct, rangeStepPct]);

  if (!hydrated || !team || !result) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  const handleAddMember = () => {
    addMember({
      name: `Team member ${team.members.length + 1}`,
      role: "AE",
      currency: "CZK",
      payPeriod: "monthly",
      base: 85000,
      targetVariable: 75000,
      quotaMode: "multiple",
      quotaMultiple: team.defaultQuotaMultiple,
      reportsToMemberId: null,
      payoutBasis: "individual",
    });
  };

  const handleExport = () => {
    const json = serializeTeam(team, result);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${team.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = deserializeTeam(text);
      if (parsed.ok) {
        importTeam(parsed.team);
        alert(`Imported team "${parsed.team.name}"`);
      } else {
        alert(`Import failed: ${parsed.error}`);
      }
    };
    input.click();
  };

  const handleViewJson = () => {
    setJsonContent(serializeTeam(team, result));
    setShowJson(true);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonContent);
    alert("Copied to clipboard!");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Team"
        description="Model reporting lines, quotas, payout rules, and named attainment scenarios."
        actions={
          <>
            <Button onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" />
              Import JSON
            </Button>
            <Button onClick={handleViewJson}>
              <Eye className="h-3.5 w-3.5" />
              View JSON
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
          </>
        }
      />

      {showJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Team JSON</h3>
              <div className="flex gap-2">
                <Button onClick={handleCopyJson}>Copy</Button>
                <Button onClick={() => setShowJson(false)}>Close</Button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-6">
              <pre className="text-xs text-slate-700">{jsonContent}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Team Configuration">
            <div className="space-y-4">
              <Field label="Team Name">
                <TextInput
                  value={team.name}
                  onChange={(name) => updateActiveTeam((t) => ({ ...t, name }))}
                  placeholder="e.g. Sales Team 2027"
                />
              </Field>
              <Field label="Default Quota Multiple" hint="Applied to new members. Monthly quota = monthly OTE × this multiple.">
                <NumberInput
                  value={team.defaultQuotaMultiple}
                  onChange={(v) => updateDefaultQuotaMultiple(v ?? 4)}
                  min={0}
                  placeholder="4"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Default Threshold" hint="No variable payout at or below this attainment.">
                  <NumberInput
                    value={team.defaultThresholdPct}
                    onChange={(v) => updateActiveTeam((t) => ({ ...t, defaultThresholdPct: v ?? 0 }))}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </Field>
                <Field label="Default Accelerator" hint="Variable payout multiple above 100%.">
                  <NumberInput
                    value={team.defaultAccelerator}
                    onChange={(v) => updateActiveTeam((t) => ({ ...t, defaultAccelerator: v ?? 1 }))}
                    min={0}
                    suffix="×"
                  />
                </Field>
                <Field label="Default Cap" hint="Blank means uncapped.">
                  <NumberInput
                    value={team.defaultCapPct}
                    onChange={(defaultCapPct) => updateActiveTeam((t) => ({ ...t, defaultCapPct }))}
                    allowNull
                    min={0}
                    suffix="%"
                  />
                </Field>
              </div>
              <Field label="Reporting Currency" hint="Currency for totals and FX conversion.">
                <Select<CurrencyCode>
                  value={reportingCurrency}
                  onChange={setReportingCurrency}
                  options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="FX Rates" description="Exchange rates for currency conversion. Edit as needed.">
            <div className="space-y-3">
              {Object.entries(team.fxRates).map(([key, value]) => (
                <Field key={key} label={key}>
                  <NumberInput
                    value={value}
                    onChange={(v) => updateFxRates({ ...team.fxRates, [key]: v ?? 1 })}
                    min={0}
                    placeholder="1"
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card
            title="Team Members"
            description="Each member has an own quota. Reporting lines roll descendant quotas into manager aggregates without double counting."
            actions={
              <Button onClick={handleAddMember} size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </Button>
            }
          >
            {result.hierarchyCycleMemberIds.length > 0 && (
              <Alert>
                A reporting cycle was detected. Calculation broke it safely; update the affected reporting lines.
              </Alert>
            )}
            {team.members.length === 0 ? (
              <Alert>No team members yet. Click "Add Member" to get started.</Alert>
            ) : (
              <div className="space-y-4">
                {team.members.map((member, idx) => {
                  const derived = result.members[idx];
                  return (
                    <div key={member.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900">{member.name}</h4>
                        <Button onClick={() => deleteMember(member.id)} size="sm" variant="ghost">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Name">
                          <TextInput
                            value={member.name}
                            onChange={(name) => updateMember(member.id, { name })}
                          />
                        </Field>
                        <Field label="Role">
                          <Select<TeamMemberRole>
                            value={member.role}
                            onChange={(role) => updateMember(member.id, { role })}
                            options={ROLE_OPTIONS}
                          />
                        </Field>
                        <Field label="Currency">
                          <Select<CurrencyCode>
                            value={member.currency}
                            onChange={(currency) => updateMember(member.id, { currency })}
                            options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
                          />
                        </Field>
                        <Field label="Pay Period">
                          <Select<PayPeriodType>
                            value={member.payPeriod}
                            onChange={(payPeriod) => updateMember(member.id, { payPeriod })}
                            options={PAY_PERIOD_OPTIONS}
                          />
                        </Field>
                        <Field label="Base">
                          <NumberInput
                            value={member.base}
                            onChange={(v) => updateMember(member.id, { base: v ?? 0 })}
                            min={0}
                          />
                        </Field>
                        <Field label="Target Variable">
                          <NumberInput
                            value={member.targetVariable}
                            onChange={(v) => updateMember(member.id, { targetVariable: v ?? 0 })}
                            min={0}
                          />
                        </Field>
                        <Field label="OTE" hint="Derived as base + target variable.">
                          <NumberInput value={member.base + member.targetVariable} onChange={() => {}} disabled />
                        </Field>
                        <Field label="Quota Mode">
                          <Select<QuotaMode>
                            value={member.quotaMode}
                            onChange={(quotaMode) => updateMember(member.id, quotaMode === "direct"
                              ? {
                                quotaMode,
                                directQuota: member.payPeriod === "monthly"
                                  ? derived.monthlyQuota
                                  : derived.annualQuota,
                              }
                              : { quotaMode, quotaMultiple: member.quotaMultiple ?? team.defaultQuotaMultiple })}
                            options={QUOTA_MODE_OPTIONS}
                          />
                        </Field>
                        {member.quotaMode === "direct" ? (
                          <Field label="Direct Quota" hint={`Amount per ${member.payPeriod} pay period.`}>
                            <NumberInput
                              value={member.directQuota ?? 0}
                              onChange={(directQuota) => updateMember(member.id, { directQuota: directQuota ?? 0 })}
                              min={0}
                            />
                          </Field>
                        ) : (
                          <Field label="OTE Quota Multiple" hint="Multiplies OTE in the selected pay period.">
                            <NumberInput
                              value={member.quotaMultiple ?? team.defaultQuotaMultiple}
                              onChange={(quotaMultiple) => updateMember(member.id, { quotaMultiple: quotaMultiple ?? team.defaultQuotaMultiple })}
                              min={0}
                            />
                          </Field>
                        )}
                        <Field label="Reports To" hint="Only cycle-safe reporting choices are available.">
                          <Select<string>
                            value={member.reportsToMemberId ?? ""}
                            onChange={(reportsToMemberId) => updateMember(member.id, {
                              reportsToMemberId: reportsToMemberId || null,
                            })}
                            options={[
                              { value: "", label: "No manager (root)" },
                              ...team.members
                                .filter((candidate) => canReportTo(member.id, candidate.id, team.members))
                                .map((candidate) => ({ value: candidate.id, label: candidate.name })),
                            ]}
                          />
                        </Field>
                        <Field
                          label="Payout Basis"
                          hint={member.payoutBasis === "team"
                            ? "Payout uses subtree attainment: (own quota × attainment + reports) / team quota."
                            : "Payout uses this member's personal attainment."}
                        >
                          <Select<PayoutBasis>
                            value={member.payoutBasis}
                            onChange={(payoutBasis) => updateMember(member.id, { payoutBasis })}
                            options={QUOTA_TYPE_OPTIONS}
                          />
                        </Field>
                        <Field label="Threshold Rule">
                          <Select<"inherit" | "override">
                            value={member.thresholdPct === undefined ? "inherit" : "override"}
                            onChange={(mode) => updateMember(member.id, {
                              thresholdPct: mode === "inherit" ? undefined : team.defaultThresholdPct,
                            })}
                            options={[
                              { value: "inherit", label: `Inherit team default (${team.defaultThresholdPct}%)` },
                              { value: "override", label: "Override" },
                            ]}
                          />
                        </Field>
                        {member.thresholdPct !== undefined && (
                          <Field label="Threshold Override">
                            <NumberInput
                              value={member.thresholdPct}
                              onChange={(thresholdPct) => updateMember(member.id, {
                                thresholdPct: (thresholdPct ?? 0) === team.defaultThresholdPct
                                  ? undefined
                                  : (thresholdPct ?? 0),
                              })}
                              min={0}
                              max={100}
                              suffix="%"
                            />
                          </Field>
                        )}
                        <Field label="Accelerator Rule">
                          <Select<"inherit" | "override">
                            value={member.accelerator === undefined ? "inherit" : "override"}
                            onChange={(mode) => updateMember(member.id, {
                              accelerator: mode === "inherit" ? undefined : team.defaultAccelerator,
                            })}
                            options={[
                              { value: "inherit", label: `Inherit team default (${team.defaultAccelerator}×)` },
                              { value: "override", label: "Override" },
                            ]}
                          />
                        </Field>
                        {member.accelerator !== undefined && (
                          <Field label="Accelerator Override">
                            <NumberInput
                              value={member.accelerator}
                              onChange={(accelerator) => updateMember(member.id, {
                                accelerator: (accelerator ?? 1) === team.defaultAccelerator
                                  ? undefined
                                  : (accelerator ?? 1),
                              })}
                              min={0}
                              suffix="×"
                            />
                          </Field>
                        )}
                        <Field label="Cap Rule">
                          <Select<"inherit" | "uncapped" | "custom">
                            value={member.capPct === undefined ? "inherit" : member.capPct === null ? "uncapped" : "custom"}
                            onChange={(mode) => updateMember(member.id, {
                              capPct: mode === "inherit" || (mode === "uncapped" && team.defaultCapPct === null)
                                ? undefined
                                : mode === "uncapped"
                                  ? null
                                  : (team.defaultCapPct ?? 200),
                            })}
                            options={[
                              { value: "inherit", label: `Inherit (${team.defaultCapPct === null ? "uncapped" : `${team.defaultCapPct}%`})` },
                              { value: "uncapped", label: "Uncapped" },
                              { value: "custom", label: "Custom cap" },
                            ]}
                          />
                        </Field>
                        {typeof member.capPct === "number" && (
                          <Field label="Custom Cap">
                            <NumberInput
                              value={member.capPct}
                              onChange={(capPct) => updateMember(member.id, {
                                capPct: (capPct ?? 200) === team.defaultCapPct
                                  ? undefined
                                  : (capPct ?? 200),
                              })}
                              min={0}
                              suffix="%"
                            />
                          </Field>
                        )}
                      </div>
                      {(() => {
                        const rules = resolvePayoutRules(member, team);
                        return rules.capPct !== null && rules.capPct <= rules.thresholdPct ? (
                          <Alert>
                            Cap ({rules.capPct}%) is at or below threshold ({rules.thresholdPct}%). Variable payout stays at 0.
                          </Alert>
                        ) : null;
                      })()}
                      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <span className="text-slate-500">Own monthly quota:</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.monthlyQuota, member.currency)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Own annual quota:</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.annualQuota, member.currency)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Aggregate monthly ({reportingCurrency}):</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.aggregateMonthlyQuota, reportingCurrency)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Aggregate annual ({reportingCurrency}):</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.aggregateAnnualQuota, reportingCurrency)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card title="Team Totals" bodyClassName="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <DollarSign className="h-4 w-4" />
            {reportingCurrency} (Reporting Currency)
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Monthly Base:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalMonthlyBase, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Monthly OTE:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalMonthlyOte, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Monthly Variable:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalMonthlyVariable, reportingCurrency)}
              </span>
            </div>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Annual Base:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalAnnualBase, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Annual OTE:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalAnnualOte, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Annual Variable:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalAnnualVariable, reportingCurrency)}
              </span>
            </div>
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Monthly Quota:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalMonthlyQuota, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Annual Quota:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(result.totals.totalAnnualQuota, reportingCurrency)}
              </span>
            </div>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">Team Monthly Quota:</span>
              <span className="font-bold text-brand-600">
                {formatCurrency(result.totals.teamMonthlyQuota, reportingCurrency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">Team Annual Quota:</span>
              <span className="font-bold text-brand-600">
                {formatCurrency(result.totals.teamAnnualQuota, reportingCurrency)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Named Scenarios"
        description="Set each member's own-quota attainment. Team-basis payouts then use computed team attainment in the results."
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="New Scenario" className="sm:max-w-xs">
            <TextInput
              value={newScenarioName}
              onChange={setNewScenarioName}
              placeholder="e.g. Stretch"
            />
          </Field>
          <Button
            onClick={() => {
              const name = newScenarioName.trim();
              if (!name) return;
              addScenario(name);
              setNewScenarioName("");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Scenario
          </Button>
        </div>

        {team.scenarios.length === 0 ? (
          <Alert>No scenarios yet. Add one to model monthly payout and annual ARR.</Alert>
        ) : (
          <>
            <div className="mb-5 overflow-x-auto">
              <table className="w-full min-w-max text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Scenario</th>
                    {team.members.map((member) => (
                      <th key={member.id} className="px-2 py-2">
                        <div>{member.name}</div>
                        <div className="font-normal">
                          Own quota attainment
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {team.scenarios.map((scenario) => (
                    <tr key={scenario.id} className="border-b border-slate-100 align-top">
                      <td className="min-w-44 px-2 py-2">
                        <TextInput
                          value={scenario.name}
                          onChange={(name) => renameScenario(scenario.id, name)}
                          ariaLabel="Scenario name"
                        />
                      </td>
                      {team.members.map((member) => (
                        <td key={member.id} className="min-w-32 px-2 py-2">
                          <NumberInput
                            value={scenario.attainmentByMemberId[member.id] ?? 0}
                            onChange={(attainment) => setScenarioAttainment(
                              scenario.id,
                              member.id,
                              attainment ?? 0,
                            )}
                            min={0}
                            suffix="%"
                            ariaLabel={`${scenario.name} attainment for ${member.name}`}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <Button
                          onClick={() => deleteScenario(scenario.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ScenarioResultsTable
              scenarios={scenarioResults}
              members={team.members}
              reportingCurrency={reportingCurrency}
            />
          </>
        )}
      </Card>

      <Card
        title="Attainment Range"
        description="Same attainment for every member. Default 0–200% in 10% steps; change the range and step as needed."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <NumberInput value={rangeStartPct} onChange={(v) => setRangeStartPct(v ?? 0)} min={0} suffix="%" />
          </Field>
          <Field label="To">
            <NumberInput value={rangeEndPct} onChange={(v) => setRangeEndPct(v ?? 0)} min={0} suffix="%" />
          </Field>
          <Field label="Step">
            <NumberInput value={rangeStepPct} onChange={(v) => setRangeStepPct(Math.max(1, v ?? 10))} min={1} suffix="%" />
          </Field>
        </div>
        {team.members.length === 0 ? (
          <Alert>Add team members to generate the attainment range table.</Alert>
        ) : (
          <ScenarioResultsTable
            scenarios={rangeResults}
            members={team.members}
            reportingCurrency={reportingCurrency}
          />
        )}
      </Card>
    </div>
  );
}
