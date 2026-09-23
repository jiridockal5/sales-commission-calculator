import { describe, expect, it } from "vitest";
import { calculateCommission } from "@/lib/commission-engine/calculateCommission";
import { createDemoPlan } from "@/lib/demo/demoPlan";
import { buildResultCsv } from "./csv";

describe("CSV export", () => {
  it("includes summary and escapes cells", () => {
    const plan = { ...createDemoPlan(), name: 'Plan "A", 2027' };
    const csv = buildResultCsv(plan, calculateCommission(plan));
    expect(csv).toContain('Plan,"Plan ""A"", 2027"');
    expect(csv).toContain("Commission,122500.00");
    expect(csv).toContain("Total employer cost,202500.00");
  });
});
