"use client";

import { create } from "zustand";
import type { TeamDefinition, TeamMember } from "@/lib/team/types";
import {
  createDefaultScenarios,
  DEFAULT_ACCELERATOR,
  DEFAULT_CAP_PCT,
  DEFAULT_THRESHOLD_PCT,
  mergeImportedTeam,
  normalizeTeam,
} from "@/lib/team/export";

const STORAGE_KEY = "sales-team-definitions";
const ACTIVE_TEAM_KEY = "active-team-id";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultScenarioAttainment(id: string, name: string): number {
  const key = `${id} ${name}`.toLowerCase();
  if (key.includes("downside")) return 50;
  if (key.includes("upside")) return 150;
  return 100;
}

function createsReportingCycle(team: TeamDefinition, memberId: string, managerId: string | null): boolean {
  if (!managerId) return false;
  if (managerId === memberId) return true;
  const byId = new Map(team.members.map((member) => [member.id, member]));
  const visited = new Set<string>();
  let currentId: string | null = managerId;
  while (currentId) {
    if (currentId === memberId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.reportsToMemberId ?? null;
  }
  return false;
}

function createDefaultTeam(): TeamDefinition {
  return {
    id: generateId(),
    name: "Sales Team 2027",
    defaultQuotaMultiple: 4,
    defaultThresholdPct: DEFAULT_THRESHOLD_PCT,
    defaultAccelerator: DEFAULT_ACCELERATOR,
    defaultCapPct: DEFAULT_CAP_PCT,
    fxRates: {
      "USD/CZK": 23,
      "EUR/CZK": 25,
      "GBP/CZK": 29,
      "USD/EUR": 0.92,
      "USD/GBP": 0.79,
    },
    members: [],
    scenarios: createDefaultScenarios([]),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface TeamState {
  hydrated: boolean;
  teams: TeamDefinition[];
  activeTeamId: string | null;

  hydrate: () => void;
  setActiveTeam: (id: string) => void;
  updateActiveTeam: (updater: (team: TeamDefinition) => TeamDefinition) => void;
  createTeam: (name?: string) => void;
  deleteTeam: (id: string) => void;
  addMember: (member: Omit<TeamMember, "id">) => void;
  updateMember: (id: string, updates: Partial<Omit<TeamMember, "id">>) => void;
  deleteMember: (id: string) => void;
  addScenario: (name: string, defaultAttainment?: number) => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  setScenarioAttainment: (scenarioId: string, memberId: string, attainment: number) => void;
  importTeam: (team: TeamDefinition) => void;
  updateFxRates: (rates: Record<string, number>) => void;
  updateDefaultQuotaMultiple: (multiple: number) => void;
}

function saveToStorage(teams: TeamDefinition[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch {
    // Storage full or disabled
  }
}

function saveActiveTeamId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(ACTIVE_TEAM_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_TEAM_KEY);
    }
  } catch {
    // Storage full or disabled
  }
}

function loadFromStorage(): TeamDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map(normalizeTeam) : [];
    }
  } catch {
    // Invalid JSON or storage error
  }
  return [];
}

function loadActiveTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_TEAM_KEY);
  } catch {
    return null;
  }
}

export const useTeamStore = create<TeamState>((set, get) => ({
  hydrated: false,
  teams: [],
  activeTeamId: null,

  hydrate: () => {
    if (typeof window === "undefined") return;
    let teams = loadFromStorage();
    if (teams.length === 0) {
      const defaultTeam = createDefaultTeam();
      teams = [defaultTeam];
    }
    saveToStorage(teams);
    let activeTeamId = loadActiveTeamId();
    if (!activeTeamId || !teams.some((t) => t.id === activeTeamId)) {
      activeTeamId = teams[0].id;
      saveActiveTeamId(activeTeamId);
    }
    set({ teams, activeTeamId, hydrated: true });
  },

  setActiveTeam: (id) => {
    set({ activeTeamId: id });
    saveActiveTeamId(id);
  },

  updateActiveTeam: (updater) => {
    const { teams, activeTeamId } = get();
    const current = teams.find((t) => t.id === activeTeamId);
    if (!current) return;
    const next = { ...updater(current), updatedAt: new Date().toISOString() };
    const newTeams = teams.map((t) => (t.id === next.id ? next : t));
    set({ teams: newTeams });
    saveToStorage(newTeams);
  },

  createTeam: (name) => {
    const team = createDefaultTeam();
    if (name) team.name = name;
    const newTeams = [...get().teams, team];
    set({ teams: newTeams, activeTeamId: team.id });
    saveToStorage(newTeams);
    saveActiveTeamId(team.id);
  },

  deleteTeam: (id) => {
    let teams = get().teams.filter((t) => t.id !== id);
    if (teams.length === 0) {
      const defaultTeam = createDefaultTeam();
      teams = [defaultTeam];
    }
    const activeTeamId = get().activeTeamId === id ? teams[0].id : get().activeTeamId;
    set({ teams, activeTeamId });
    saveToStorage(teams);
    saveActiveTeamId(activeTeamId);
  },

  addMember: (member) => {
    const id = generateId();
    get().updateActiveTeam((team) => ({
      ...team,
      members: [...team.members, { ...member, id }],
      scenarios: team.scenarios.map((scenario) => ({
        ...scenario,
        attainmentByMemberId: {
          ...scenario.attainmentByMemberId,
          [id]: defaultScenarioAttainment(scenario.id, scenario.name),
        },
      })),
    }));
  },

  updateMember: (id, updates) => {
    get().updateActiveTeam((team) => ({
      ...team,
      members: team.members.map((member) => {
        if (member.id !== id) return member;
        const reportsToMemberId = updates.reportsToMemberId;
        if (reportsToMemberId !== undefined && createsReportingCycle(team, id, reportsToMemberId)) {
          return member;
        }
        return { ...member, ...updates };
      }),
    }));
  },

  deleteMember: (id) => {
    get().updateActiveTeam((team) => ({
      ...team,
      members: team.members
        .filter((member) => member.id !== id)
        .map((member) => member.reportsToMemberId === id
          ? { ...member, reportsToMemberId: null }
          : member),
      scenarios: team.scenarios.map((scenario) => {
        const { [id]: _removed, ...attainmentByMemberId } = scenario.attainmentByMemberId;
        void _removed;
        return { ...scenario, attainmentByMemberId };
      }),
    }));
  },

  addScenario: (name, defaultAttainment = 100) => {
    get().updateActiveTeam((team) => ({
      ...team,
      scenarios: [...team.scenarios, {
        id: generateId(),
        name,
        attainmentByMemberId: Object.fromEntries(
          team.members.map((member) => [member.id, defaultAttainment]),
        ),
      }],
    }));
  },

  renameScenario: (id, name) => {
    get().updateActiveTeam((team) => ({
      ...team,
      scenarios: team.scenarios.map((scenario) => scenario.id === id ? { ...scenario, name } : scenario),
    }));
  },

  deleteScenario: (id) => {
    get().updateActiveTeam((team) => ({
      ...team,
      scenarios: team.scenarios.filter((scenario) => scenario.id !== id),
    }));
  },

  setScenarioAttainment: (scenarioId, memberId, attainment) => {
    get().updateActiveTeam((team) => ({
      ...team,
      scenarios: team.scenarios.map((scenario) => scenario.id === scenarioId
        ? {
          ...scenario,
          attainmentByMemberId: { ...scenario.attainmentByMemberId, [memberId]: attainment },
        }
        : scenario),
    }));
  },

  importTeam: (team) => {
    const active = get().teams.find((t) => t.id === get().activeTeamId);
    const merged = mergeImportedTeam(team, active?.fxRates ?? {});
    const exists = get().teams.some((t) => t.id === merged.id);
    const imported = exists ? { ...merged, id: generateId() } : merged;
    const newTeams = [...get().teams, imported];
    set({ teams: newTeams, activeTeamId: imported.id });
    saveToStorage(newTeams);
    saveActiveTeamId(imported.id);
  },

  updateFxRates: (rates) => {
    get().updateActiveTeam((team) => ({
      ...team,
      fxRates: rates,
    }));
  },

  updateDefaultQuotaMultiple: (multiple) => {
    get().updateActiveTeam((team) => ({
      ...team,
      defaultQuotaMultiple: multiple,
    }));
  },
}));

export function useActiveTeam(): TeamDefinition | null {
  return useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId) ?? null);
}
