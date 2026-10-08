"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload, Eye, DollarSign } from "lucide-react";
import { Button, Field, Select, TextInput, NumberInput } from "@/components/ui/controls";
import { Alert, Card, PageHeader } from "@/components/ui/layout";
import { useTeamStore, useActiveTeam } from "@/store/teamStore";
import { calculateTeam } from "@/lib/team/calculations";
import { serializeTeam, deserializeTeam } from "@/lib/team/export";
import { formatCurrency } from "@/lib/format/currency";
import type { CurrencyCode, TeamMemberRole, PayPeriodType, QuotaType } from "@/lib/team/types";
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

const QUOTA_TYPE_OPTIONS: { value: QuotaType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "team", label: "Team" },
];

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

  const [reportingCurrency, setReportingCurrency] = useState<CurrencyCode>("CZK");
  const [showJson, setShowJson] = useState(false);
  const [jsonContent, setJsonContent] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const result = useMemo(() => {
    if (!team) return null;
    return calculateTeam(team, reportingCurrency);
  }, [team, reportingCurrency]);

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
      ote: 160000,
      quotaType: "individual",
      quotaMultiple: team.defaultQuotaMultiple,
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
        description="Define your sales team structure and derive compensation goals from OTE and quota multiples."
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
            description="Add members, set their base/OTE, and configure quota type and multiple."
            actions={
              <Button onClick={handleAddMember} size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Member
              </Button>
            }
          >
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
                        <Field label="OTE">
                          <NumberInput
                            value={member.ote}
                            onChange={(v) => updateMember(member.id, { ote: v ?? 0 })}
                            min={0}
                          />
                        </Field>
                        <Field label="Quota Type">
                          <Select<QuotaType>
                            value={member.quotaType}
                            onChange={(quotaType) => updateMember(member.id, { quotaType })}
                            options={QUOTA_TYPE_OPTIONS}
                          />
                        </Field>
                        <Field label="Quota Multiple">
                          <NumberInput
                            value={member.quotaMultiple}
                            onChange={(v) => updateMember(member.id, { quotaMultiple: v ?? 4 })}
                            min={0}
                          />
                        </Field>
                      </div>
                      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-slate-500">Variable:</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.variable, member.currency)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Monthly Quota:</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.monthlyQuota, member.currency)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Annual Quota:</span>{" "}
                          <span className="font-medium">{formatCurrency(derived.annualQuota, member.currency)}</span>
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
    </div>
  );
}
