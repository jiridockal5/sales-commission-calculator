import type { TeamDefinition, TeamCalculationResult } from "@/lib/team/types";

export const TEAM_EXPORT_FORMAT = "sales-team-definition";
export const TEAM_SCHEMA_VERSION = 1;

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

export function deserializeTeam(json: string): { ok: true; team: TeamDefinition } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json);
    if (typeof data !== "object" || data === null) {
      return { ok: false, error: "Invalid JSON structure." };
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
    
    return { ok: true, team };
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
}
