"use client";

import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Menu as MenuIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Menu, MenuDivider, MenuItem, Select, cn } from "@/components/ui/controls";
import { useCalculation } from "@/hooks/useCalculation";
import type { CommissionPlan, CurrencyCode, PeriodType } from "@/lib/commission-engine/types";
import { PERIOD_TYPE_LABELS } from "@/lib/commission-engine/periods";
import { exportResultCsv } from "@/lib/export/csv";
import { exportPlanJson, readPlanFile } from "@/lib/export/json";
import { CURRENCIES } from "@/lib/format/currency";
import { buildShareUrl } from "@/lib/persistence/serialization";
import { changeCalculationPeriod } from "@/lib/plan/planOperations";
import { usePlanStore } from "@/store/planStore";

function PlanNameInput({ plan }: { plan: CommissionPlan }) {
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const [value, setValue] = useState(plan.name);
  useEffect(() => setValue(plan.name), [plan.name, plan.id]);
  const commit = () => {
    if (value.trim() && value !== plan.name) renamePlan(plan.id, value);
    else setValue(plan.name);
  };
  return (
    <input
      aria-label="Plan name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(plan.name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white sm:w-56"
    />
  );
}

export function TopBar({ plan, onOpenSidebar }: { plan: CommissionPlan; onOpenSidebar: () => void }) {
  const store = usePlanStore();
  const result = useCalculation(plan);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await readPlanFile(file);
    if (parsed.ok) {
      store.importPlan(parsed.plan);
      store.setNotice(`Imported "${parsed.plan.name}".`);
    } else {
      store.setNotice(`Import failed: ${parsed.error}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onShare = async () => {
    const url = buildShareUrl(plan, `${window.location.origin}/setup`);
    if (!url) {
      store.setNotice("This plan is too large for a share link. Use JSON export instead.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      store.setNotice("Share link copied to clipboard.");
    } catch {
      window.prompt("Copy this share link:", url);
    }
  };

  const saveLabel =
    store.saveStatus === "saving" ? "Saving" : store.saveStatus === "error" ? "Save failed" : "Saved";

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-4">
      <button type="button" className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={onOpenSidebar} aria-label="Open menu">
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center md:flex-none">
        <Menu
          align="left"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label="Switch plan"
              className={cn("flex h-8 items-center gap-1 rounded-md px-1.5 text-slate-500 hover:bg-slate-100", open && "bg-slate-100")}
            >
              <FolderOpen className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Saved plans</div>
              <div className="max-h-72 overflow-y-auto">
                {store.plans.map((p) => (
                  <MenuItem
                    key={p.id}
                    icon={p.id === plan.id ? <Check className="h-3.5 w-3.5 text-brand-600" /> : <span className="inline-block w-3.5" />}
                    onClick={() => {
                      store.setActivePlan(p.id);
                      close();
                    }}
                  >
                    <span className="truncate">{p.name}</span>
                  </MenuItem>
                ))}
              </div>
              <MenuDivider />
              <MenuItem icon={<Plus className="h-3.5 w-3.5" />} onClick={() => (store.startFromScratch(), close())}>
                New plan (start from scratch)
              </MenuItem>
              <MenuItem icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => (store.createPlan("demo"), close())}>
                New plan from demo
              </MenuItem>
            </>
          )}
        </Menu>
        <PlanNameInput plan={plan} />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden items-center gap-1.5 md:flex">
          <Select<CurrencyCode>
            ariaLabel="Currency"
            className="w-24"
            value={plan.currency}
            onChange={(currency) => store.updateActivePlan((p) => ({ ...p, currency }))}
            options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))}
          />
          <Select<PeriodType>
            ariaLabel="Calculation period"
            className="w-36"
            value={plan.calculationPeriod}
            onChange={(t) => store.updateActivePlan((p) => changeCalculationPeriod(p, t))}
            options={(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((t) => ({ value: t, label: PERIOD_TYPE_LABELS[t] }))}
          />
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <Button onClick={() => store.saveNow()} title="Plans auto-save to this browser">
            {store.saveStatus === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saveLabel}
          </Button>
          <Button onClick={() => store.duplicatePlan(plan.id)}>
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
        </div>

        <Menu
          trigger={({ toggle }) => (
            <Button variant="primary" onClick={toggle}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={() => (exportResultCsv(plan, result), close())}>
                Export results (CSV)
              </MenuItem>
              <MenuItem icon={<FileText className="h-3.5 w-3.5" />} onClick={() => (window.open("/report", "_blank"), close())}>
                Export report (PDF)
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<FileJson className="h-3.5 w-3.5" />} onClick={() => (exportPlanJson(plan), close())}>
                Export plan (JSON)
              </MenuItem>
              <MenuItem icon={<Upload className="h-3.5 w-3.5" />} onClick={() => (fileRef.current?.click(), close())}>
                Import plan (JSON)
              </MenuItem>
              <MenuItem icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => (void onShare(), close())}>
                Copy share link
              </MenuItem>
            </>
          )}
        </Menu>

        <Menu
          trigger={({ toggle }) => (
            <Button variant="ghost" onClick={toggle} aria-label="More actions" className="px-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Copy className="h-3.5 w-3.5" />} onClick={() => (store.duplicatePlan(plan.id), close())}>
                Duplicate plan
              </MenuItem>
              <MenuItem
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => {
                  close();
                  if (window.confirm(`Reset "${plan.name}" to the demo configuration?`)) store.resetPlan(plan.id, "demo");
                }}
              >
                Reset to demo plan
              </MenuItem>
              <MenuItem
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => {
                  close();
                  if (window.confirm(`Reset "${plan.name}" to a blank configuration?`)) store.resetPlan(plan.id, "blank");
                }}
              >
                Reset to blank plan
              </MenuItem>
              <MenuDivider />
              <MenuItem
                danger
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  close();
                  if (window.confirm(`Delete "${plan.name}"? This cannot be undone.`)) store.deletePlan(plan.id);
                }}
              >
                Delete plan
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onImport(e.target.files?.[0])}
      />
    </header>
  );
}
