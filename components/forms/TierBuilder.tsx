"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, NumberInput } from "@/components/ui/controls";
import { Alert, DataTable, Td, Th } from "@/components/ui/layout";
import { updateTierBound, validateTiers } from "@/lib/commission-engine/tiers";
import type { CommissionTier } from "@/lib/commission-engine/types";
import { createId } from "@/lib/plan/ids";

/**
 * Editable tier table. Tiers stay contiguous: editing a tier's upper bound moves the
 * next tier's lower bound; removing a tier merges its range into the neighbour.
 */
export function TierBuilder({ tiers, onChange }: { tiers: CommissionTier[]; onChange: (tiers: CommissionTier[]) => void }) {
  // Keep the order the user created. Sorting on each edit moves the focused row.
  const errors = validateTiers(tiers, { preserveOrder: true });

  const setRate = (i: number, rate: number) => onChange(tiers.map((t, j) => (j === i ? { ...t, rate } : t)));

  const add = () => {
    const next = tiers.map((t) => ({ ...t }));
    const last = next[next.length - 1];
    if (!last) {
      onChange([{ id: createId("tier"), fromPct: 0, toPct: null, rate: 10 }]);
      return;
    }
    const boundary = last.fromPct + 25;
    last.toPct = boundary;
    next.push({ id: createId("tier"), fromPct: boundary, toPct: null, rate: last.rate + 5 });
    onChange(next);
  };

  const remove = (i: number) => {
    const next = tiers.map((t) => ({ ...t })).filter((_, j) => j !== i);
    if (next.length === 0) return;
    if (i === tiers.length - 1) next[next.length - 1].toPct = null;
    else if (i === 0) next[0].fromPct = 0;
    else next[i].fromPct = next[i - 1].toPct ?? next[i].fromPct;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <DataTable>
        <thead>
          <tr>
            <Th>From (attainment)</Th>
            <Th>To (attainment)</Th>
            <Th align="right">Commission rate</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => (
            <tr key={tier.id}>
              <Td className="w-36">
                <NumberInput
                  suffix="%"
                  min={0}
                  commitOnBlur
                  value={tier.fromPct}
                  onChange={(v) => onChange(updateTierBound(tiers, i, "fromPct", v ?? 0, true))}
                  ariaLabel={`Tier ${i + 1} from`}
                />
              </Td>
              <Td className="w-36">
                {tier.toPct === null ? (
                  <span className="text-xs text-slate-500">and above</span>
                ) : (
                  <NumberInput
                    suffix="%"
                    min={0}
                    commitOnBlur
                    value={tier.toPct}
                    onChange={(v) => onChange(updateTierBound(tiers, i, "toPct", v ?? 0, true))}
                    ariaLabel={`Tier ${i + 1} to`}
                  />
                )}
              </Td>
              <Td align="right" className="w-36">
                <NumberInput suffix="%" min={0} value={tier.rate} onChange={(v) => setRate(i, v ?? 0)} ariaLabel={`Tier ${i + 1} rate`} />
              </Td>
              <Td align="right">
                <Button variant="ghost" size="sm" aria-label="Remove tier" disabled={tiers.length <= 1} onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {errors.length > 0 && <Alert tone="warning">{errors.join(" ")}</Alert>}
      <Button size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add tier
      </Button>
    </div>
  );
}
