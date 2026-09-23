"use client";

import { create } from "zustand";
import type { CommissionPlan } from "@/lib/commission-engine/types";
import { createDemoPlan } from "@/lib/demo/demoPlan";
import { createStartFromScratchPlan } from "@/lib/demo/blankPlan";
import { LocalStoragePlanRepository } from "@/lib/persistence/LocalStoragePlanRepository";
import type { PlanRepository } from "@/lib/persistence/PlanRepository";
import { decodePlanFromUrl } from "@/lib/persistence/serialization";
import { clonePlanWithNewIds, createBlankPlan } from "@/lib/plan/planFactory";
import { touch } from "@/lib/plan/planOperations";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface PlanState {
  hydrated: boolean;
  plans: CommissionPlan[];
  activePlanId: string | null;
  saveStatus: SaveStatus;
  compareIds: string[];
  notice: string | null;

  hydrate: () => Promise<void>;
  setActivePlan: (id: string) => void;
  updateActivePlan: (updater: (plan: CommissionPlan) => CommissionPlan) => void;
  createPlan: (kind: "blank" | "demo", name?: string) => void;
  startFromScratch: () => void;
  duplicatePlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  resetPlan: (id: string, to: "blank" | "demo") => void;
  importPlan: (plan: CommissionPlan) => void;
  /** Adds plans without switching the active plan and includes them in the comparison. */
  addPlansForComparison: (plans: CommissionPlan[]) => void;
  saveNow: () => Promise<void>;
  setCompareIds: (ids: string[]) => void;
  setNotice: (notice: string | null) => void;
}

const repository: PlanRepository = new LocalStoragePlanRepository();
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

function uniqueName(plans: CommissionPlan[], base: string): string {
  const names = new Set(plans.map((p) => p.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

export const usePlanStore = create<PlanState>((set, get) => {
  const persist = (plan: CommissionPlan, immediate = false) => {
    set({ saveStatus: "saving" });
    const existing = pendingSaves.get(plan.id);
    if (existing) clearTimeout(existing);
    const run = async () => {
      pendingSaves.delete(plan.id);
      const latest = get().plans.find((p) => p.id === plan.id);
      if (!latest) return;
      try {
        await repository.save(latest);
        if (pendingSaves.size === 0) set({ saveStatus: "saved" });
      } catch {
        set({ saveStatus: "error", notice: "Could not save to browser storage (storage full or disabled)." });
      }
    };
    if (immediate) void run();
    else pendingSaves.set(plan.id, setTimeout(run, 400));
  };

  const addAndActivate = (plan: CommissionPlan) => {
    set((s) => ({ plans: [...s.plans, plan], activePlanId: plan.id }));
    void repository.setActivePlanId(plan.id);
    persist(plan, true);
  };

  let hydrationPromise: Promise<void> | null = null;

  const hydrateOnce = async () => {
    let plans = await repository.list();
    let activePlanId = await repository.getActivePlanId();
    let notice: string | null = null;

    if (plans.length === 0) {
      const demo = createDemoPlan();
      plans = [demo];
      activePlanId = demo.id;
      await repository.save(demo);
    }

    if (typeof window !== "undefined" && window.location.hash.startsWith("#plan=")) {
      const decoded = decodePlanFromUrl(window.location.hash.slice("#plan=".length));
      if (decoded.ok) {
        const shared = clonePlanWithNewIds(decoded.plan, uniqueName(plans, `${decoded.plan.name} (shared)`));
        plans = [...plans, shared];
        activePlanId = shared.id;
        await repository.save(shared);
        notice = `Imported shared plan "${shared.name}".`;
      } else {
        notice = decoded.error;
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    if (!activePlanId || !plans.some((p) => p.id === activePlanId)) activePlanId = plans[0].id;
    await repository.setActivePlanId(activePlanId);
    set({ plans, activePlanId, hydrated: true, saveStatus: "saved", notice, compareIds: plans.slice(0, 3).map((p) => p.id) });
  };

  return {
    hydrated: false,
    plans: [],
    activePlanId: null,
    saveStatus: "idle",
    compareIds: [],
    notice: null,

    hydrate: () => {
      hydrationPromise ??= hydrateOnce();
      return hydrationPromise;
    },

    setActivePlan: (id) => {
      set({ activePlanId: id });
      void repository.setActivePlanId(id);
    },

    updateActivePlan: (updater) => {
      const { plans, activePlanId } = get();
      const current = plans.find((p) => p.id === activePlanId);
      if (!current) return;
      const next = touch(updater(current));
      set({ plans: plans.map((p) => (p.id === next.id ? next : p)) });
      persist(next);
    },

    createPlan: (kind, name) => {
      const base = kind === "demo" ? createDemoPlan() : createBlankPlan();
      addAndActivate({ ...base, name: uniqueName(get().plans, name ?? (kind === "demo" ? "Demo plan" : "New plan")) });
    },

    startFromScratch: () => {
      addAndActivate(createStartFromScratchPlan(uniqueName(get().plans, "New plan")));
    },

    duplicatePlan: (id) => {
      const source = get().plans.find((p) => p.id === id);
      if (!source) return;
      addAndActivate(clonePlanWithNewIds(source, uniqueName(get().plans, `${source.name} (copy)`)));
    },

    renamePlan: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const plans = get().plans.map((p) => (p.id === id ? touch({ ...p, name: trimmed }) : p));
      set({ plans });
      const plan = plans.find((p) => p.id === id);
      if (plan) persist(plan);
    },

    deletePlan: (id) => {
      const pending = pendingSaves.get(id);
      if (pending) clearTimeout(pending);
      pendingSaves.delete(id);
      let plans = get().plans.filter((p) => p.id !== id);
      if (plans.length === 0) {
        const blank = createBlankPlan();
        plans = [blank];
        void repository.save(blank);
      }
      const activePlanId = get().activePlanId === id ? plans[0].id : get().activePlanId;
      set({ plans, activePlanId, compareIds: get().compareIds.filter((c) => c !== id) });
      void repository.delete(id);
      void repository.setActivePlanId(activePlanId);
    },

    resetPlan: (id, to) => {
      const current = get().plans.find((p) => p.id === id);
      if (!current) return;
      const template = to === "demo" ? createDemoPlan() : createBlankPlan();
      const plan = touch({ ...clonePlanWithNewIds(template, current.name, current.id), createdAt: current.createdAt });
      set({ plans: get().plans.map((p) => (p.id === id ? plan : p)) });
      persist(plan, true);
    },

    importPlan: (plan) => {
      const exists = get().plans.some((p) => p.id === plan.id);
      const name = uniqueName(get().plans, plan.name);
      addAndActivate(exists ? clonePlanWithNewIds(plan, name) : { ...plan, name });
    },

    addPlansForComparison: (newPlans) => {
      const named = newPlans.map((p, i) => ({ ...p, name: uniqueName([...get().plans, ...newPlans.slice(0, i)], p.name) }));
      set((s) => ({
        plans: [...s.plans, ...named],
        compareIds: [...new Set([...s.compareIds, s.activePlanId ?? "", ...named.map((p) => p.id)])].filter(Boolean),
      }));
      named.forEach((p) => persist(p, true));
    },

    saveNow: async () => {
      const plan = get().plans.find((p) => p.id === get().activePlanId);
      if (plan) persist(plan, true);
    },

    setCompareIds: (ids) => set({ compareIds: ids }),
    setNotice: (notice) => set({ notice }),
  };
});

export function useActivePlan(): CommissionPlan | null {
  return usePlanStore((s) => s.plans.find((p) => p.id === s.activePlanId) ?? null);
}
