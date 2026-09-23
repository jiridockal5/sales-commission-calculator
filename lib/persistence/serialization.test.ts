import { describe, expect, it } from "vitest";
import { calculateCommission } from "@/lib/commission-engine/calculateCommission";
import { createDemoPlan } from "@/lib/demo/demoPlan";
import { LocalStoragePlanRepository } from "./LocalStoragePlanRepository";
import { buildShareUrl, decodePlanFromUrl, deserializePlan, encodePlanForUrl, serializePlan } from "./serialization";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("JSON serialization", () => {
  it("round-trips a plan", () => {
    const plan = createDemoPlan();
    const parsed = deserializePlan(serializePlan(plan));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.plan).toEqual(plan);
  });

  it("rejects invalid input", () => {
    expect(deserializePlan("not json").ok).toBe(false);
    expect(deserializePlan("{}").ok).toBe(false);
    expect(deserializePlan(JSON.stringify({ id: "x", name: "y", revenueTypes: [], rules: [{}], periods: [] })).ok).toBe(
      false,
    );
    expect(deserializePlan(JSON.stringify({ ...createDemoPlan(), schemaVersion: 99 })).ok).toBe(false);
  });

  it("fills missing optional sections with defaults", () => {
    const { features, ote, ...rest } = createDemoPlan();
    void features;
    void ote;
    const parsed = deserializePlan(JSON.stringify(rest));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.plan.features.draw).toBe(false);
  });
});

describe("URL sharing", () => {
  it("encodes a compact plan that calculates identically", () => {
    const plan = createDemoPlan();
    const decoded = decodePlanFromUrl(encodePlanForUrl(plan));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(calculateCommission(decoded.plan).totals).toEqual(calculateCommission(plan).totals);
    }
    expect(buildShareUrl(plan, "https://example.com/")).not.toBeNull();
  });
});

describe("LocalStoragePlanRepository", () => {
  it("saves, lists and deletes plans", async () => {
    const repo = new LocalStoragePlanRepository(new MemoryStorage());
    const plan = createDemoPlan();
    await repo.save(plan);
    await repo.save({ ...plan, name: "Renamed" });
    expect((await repo.list()).map((p) => p.name)).toEqual(["Renamed"]);
    await repo.setActivePlanId(plan.id);
    expect(await repo.getActivePlanId()).toBe(plan.id);
    await repo.delete(plan.id);
    expect(await repo.list()).toEqual([]);
  });
});
