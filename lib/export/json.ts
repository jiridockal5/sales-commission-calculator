import type { CommissionPlan } from "@/lib/commission-engine/types";
import { deserializePlan, serializePlan, type ParseResult } from "@/lib/persistence/serialization";
import { downloadFile, slugify } from "./download";

export function exportPlanJson(plan: CommissionPlan): void {
  downloadFile(`${slugify(plan.name)}.json`, serializePlan(plan), "application/json");
}

export async function readPlanFile(file: File): Promise<ParseResult> {
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "File is too large (max 5 MB)." };
  return deserializePlan(await file.text());
}
