import type {
  TeamDefinition,
  TeamCalculationResult,
  TeamMember,
  TeamScenario,
} from "@/lib/team/types";

export const TEAM_EXPORT_FORMAT = "sales-team-definition";
export const TEAM_SCHEMA_VERSION = 3;
export const DEFAULT_THRESHOLD_PCT = 0;
export const DEFAULT_ACCELERATOR = 1;
export const DEFAULT_CAP_PCT: number | null = null;

const DEFAULT_SCENARIOS = [
  { id: "downside", name: "Downside", attainment: 50 },
  { id: "plan", name: "Plan", attainment: 100 },
  { id: "upside", name: "Upside", attainment: 150 },
] as const;

export interface TeamExportFile {
  format: typeof TEAM_EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  team: TeamDefinition;
  derived?: TeamCalculationResult;
}

export function serializeTeam(team: TeamDefinition, derived?: TeamCalculationResult): string {
  const file: TeamExportFile = {
    format: TEAM_EXPORT_FORMAT,
    schemaVersion: TEAM_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    team,
    ...(derived && { derived }),
  };
  return JSON.stringify(file, null, 2);
}

function scenarioDefault(id: string, name: string): number {
  const key = `${id} ${name}`.toLowerCase();
  if (key.includes("downside")) return 50;
  if (key.includes("upside")) return 150;
  return 100;
}

export function createDefaultScenarios(memberIds: string[]): TeamScenario[] {
  return DEFAULT_SCENARIOS.map(({ id, name, attainment }) => ({
    id,
    name,
    attainmentByMemberId: Object.fromEntries(memberIds.map((memberId) => [memberId, attainment])),
  }));
}

export function normalizeTeam(team: TeamDefinition): TeamDefinition {
  const now = new Date().toISOString();
  const raw = team as TeamDefinition & Record<string, unknown>;
  const defaultQuotaMultiple = typeof raw.defaultQuotaMultiple === "number"
    ? raw.defaultQuotaMultiple
    : 4;
  const rawMembers = Array.isArray(raw.members) ? raw.members : [];
  const legacyTeamManagerIds = new Set(rawMembers.flatMap((value) => {
    const member = value as { id?: unknown; quotaType?: unknown };
    return member.quotaType === "team" && typeof member.id === "string" ? [member.id] : [];
  }));
  const members: TeamMember[] = rawMembers.map((value) => {
    const member = value as TeamMember & {
      ote?: unknown;
      quotaType?: unknown;
      quotaMultiple?: unknown;
    };
    const legacyOte = typeof member.ote === "number" ? member.ote : null;
    const legacyMultiple = typeof member.quotaMultiple === "number"
      ? member.quotaMultiple
      : defaultQuotaMultiple;
    const isLegacyTeamManager = member.quotaType === "team";
    const quotaMode = member.quotaMode === "multiple" || member.quotaMode === "direct"
      ? member.quotaMode
      : isLegacyTeamManager
        ? "multiple"
      : legacyOte !== null
        ? "direct"
        : "multiple";
    const {
      ote: _legacyOte,
      quotaType: _legacyQuotaType,
      ...canonical
    } = member;
    void _legacyOte;
    void _legacyQuotaType;
    const hasExplicitTarget = typeof member.targetVariable === "number"
      && !(member.targetVariable === 0 && legacyOte !== null);
    return {
      ...canonical,
      targetVariable: hasExplicitTarget
        ? member.targetVariable
        : legacyOte !== null
          ? Math.max(legacyOte - (typeof member.base === "number" ? member.base : 0), 0)
          : 0,
      quotaMode,
      ...(quotaMode === "direct"
        ? { directQuota: typeof member.directQuota === "number"
          ? member.directQuota
          : (legacyOte ?? 0) * legacyMultiple, quotaMultiple: undefined }
        : { quotaMultiple: legacyMultiple, directQuota: undefined }),
      reportsToMemberId: typeof member.reportsToMemberId === "string"
        ? member.reportsToMemberId
        : null,
      payoutBasis: member.payoutBasis === "team" || member.payoutBasis === "individual"
        ? member.payoutBasis
        : member.quotaType === "team"
          ? "team"
          : "individual",
    };
  });
  const memberIds = new Set(members.map((member) => member.id));
  for (const member of members) {
    if (member.reportsToMemberId === member.id || !memberIds.has(member.reportsToMemberId ?? "")) {
      member.reportsToMemberId = null;
    }
  }
  const primaryLegacyManager = members.find((member) => legacyTeamManagerIds.has(member.id));
  if (primaryLegacyManager) {
    // Legacy files had no hierarchy. If several team-quota managers exist, keep
    // each manager as a root and use the first in source order for unassigned
    // non-manager members so migration is deterministic.
    for (const member of members) {
      if (!legacyTeamManagerIds.has(member.id) && member.reportsToMemberId === null) {
        member.reportsToMemberId = primaryLegacyManager.id;
      }
    }
  }

  const rawScenarios = Array.isArray(raw.scenarios) ? raw.scenarios : null;
  const scenarios = rawScenarios
    ? rawScenarios.map((value, index): TeamScenario => {
      const scenario = value as Partial<TeamScenario>;
      const id = typeof scenario.id === "string" && scenario.id ? scenario.id : `scenario-${index + 1}`;
      const name = typeof scenario.name === "string" && scenario.name ? scenario.name : `Scenario ${index + 1}`;
      const source = scenario.attainmentByMemberId && typeof scenario.attainmentByMemberId === "object"
        ? scenario.attainmentByMemberId
        : {};
      const fallback = scenarioDefault(id, name);
      return {
        id,
        name,
        attainmentByMemberId: Object.fromEntries(members.map((member) => [
          member.id,
          typeof source[member.id] === "number" ? source[member.id] : fallback,
        ])),
      };
    })
    : createDefaultScenarios(members.map((member) => member.id));

  return {
    ...team,
    defaultQuotaMultiple,
    defaultThresholdPct: typeof raw.defaultThresholdPct === "number" ? raw.defaultThresholdPct : DEFAULT_THRESHOLD_PCT,
    defaultAccelerator: typeof raw.defaultAccelerator === "number" ? raw.defaultAccelerator : DEFAULT_ACCELERATOR,
    defaultCapPct: typeof raw.defaultCapPct === "number" || raw.defaultCapPct === null
      ? raw.defaultCapPct
      : DEFAULT_CAP_PCT,
    fxRates: typeof raw.fxRates === "object" && raw.fxRates !== null ? raw.fxRates as Record<string, number> : {},
    members,
    scenarios,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function mergeImportedTeam(team: TeamDefinition, currentFxRates: Record<string, number>): TeamDefinition {
  const normalized = normalizeTeam(team);
  return { ...normalized, fxRates: { ...currentFxRates, ...normalized.fxRates } };
}

export function deserializeTeam(json: string): { ok: true; team: TeamDefinition } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json);
    if (typeof data !== "object" || data === null) {
      return { ok: false, error: "Invalid JSON structure." };
    }

    if (
      data.format === TEAM_EXPORT_FORMAT
      && typeof data.schemaVersion === "number"
      && data.schemaVersion > TEAM_SCHEMA_VERSION
    ) {
      return {
        ok: false,
        error: `This team file uses schema version ${data.schemaVersion}, but this app supports up to version ${TEAM_SCHEMA_VERSION}.`,
      };
    }
    
    const team = data.format === TEAM_EXPORT_FORMAT && data.team ? data.team : data;
    
    if (typeof team !== "object" || team === null) {
      return { ok: false, error: "Team data is not an object." };
    }
    
    if (typeof team.id !== "string" || !team.id) {
      return { ok: false, error: "Team is missing an id." };
    }
    
    if (typeof team.name !== "string") {
      return { ok: false, error: "Team is missing a name." };
    }
    
    if (!Array.isArray(team.members)) {
      return { ok: false, error: "Team members must be an array." };
    }
    
    return { ok: true, team: normalizeTeam(team as TeamDefinition) };
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
}
