"use client";

import { NumberInput, Segmented, Switch, TextInput } from "@/components/ui/controls";
import { Alert, Card, DataTable, PageHeader, Td, Th } from "@/components/ui/layout";
import { usePlan } from "@/hooks/usePlan";
import type { RevenueTypeKey } from "@/lib/commission-engine/types";
import { updateRevenueType } from "@/lib/plan/planOperations";

const DESCRIPTIONS: Record<RevenueTypeKey, string> = {
  new_arr: "Annual recurring revenue from new customers.",
  new_mrr: "Monthly recurring revenue from new customers.",
  acv: "Annual contract value.",
  tcv: "Total contract value over the full term.",
  one_time: "Implementation, services and other non-recurring fees.",
  expansion: "Additional recurring revenue from existing customers.",
  upsell: "Upgrades to higher plans or tiers.",
  cross_sell: "Additional products sold to existing customers.",
  renewal: "Recurring revenue renewed during the period.",
};

export default function RevenueTypesPage() {
  const { plan, update } = usePlan();
  const types = [...plan.revenueTypes].sort((a, b) => a.sortOrder - b.sortOrder);
  const anyEnabled = types.some((t) => t.enabled);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Revenue types"
        description="Enable the metrics that pay commission. Each type has its own quota, rate, accelerators, threshold, cap and credit weighting."
      />
      {!anyEnabled && <Alert tone="warning">Enable at least one revenue type to calculate commission.</Alert>}
      <Card bodyClassName="p-0">
        <DataTable>
          <thead>
            <tr>
              <Th>Enabled</Th>
              <Th>Revenue type</Th>
              <Th>Measurement</Th>
              <Th align="right">Credit weighting</Th>
            </tr>
          </thead>
          <tbody>
            {types.map((rt) => (
              <tr key={rt.id} className={rt.enabled ? "" : "text-slate-400"}>
                <Td className="w-20">
                  <Switch checked={rt.enabled} onChange={(enabled) => update((p) => updateRevenueType(p, rt.id, { enabled }))} />
                </Td>
                <Td className="min-w-56">
                  <TextInput
                    ariaLabel={`${rt.key} label`}
                    value={rt.label}
                    onChange={(label) => update((p) => updateRevenueType(p, rt.id, { label }))}
                  />
                  <div className="mt-1 text-xs text-slate-500">{DESCRIPTIONS[rt.key]}</div>
                </Td>
                <Td>
                  <Segmented
                    size="sm"
                    value={rt.quotaBased ? "quota" : "flat"}
                    onChange={(v) => update((p) => updateRevenueType(p, rt.id, { quotaBased: v === "quota" }))}
                    options={[
                      { value: "quota", label: "Against quota" },
                      { value: "flat", label: "Flat rate" },
                    ]}
                  />
                </Td>
                <Td align="right" className="w-36">
                  <NumberInput
                    suffix="%"
                    min={0}
                    value={rt.weighting}
                    onChange={(v) => update((p) => updateRevenueType(p, rt.id, { weighting: v ?? 0 }))}
                    ariaLabel={`${rt.label} weighting`}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
      <Alert>
        <strong>Against quota</strong> types count toward quota attainment and use tiers/accelerators. <strong>Flat rate</strong> types (typically
        renewals) pay a fixed percentage on credited revenue, separate from the main quota. <strong>Credit weighting</strong> sets the share of
        actual revenue credited, e.g. 50% for multi-year TCV.
      </Alert>
    </div>
  );
}
