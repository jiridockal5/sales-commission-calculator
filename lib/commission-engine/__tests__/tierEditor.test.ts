import { describe, expect, it } from "vitest";
import { updateTierBound } from "../tiers";
import { createTier } from "@/lib/plan/planFactory";

describe("tier editor order", () => {
  const tiers = () => [createTier(0, 50, 10), createTier(50, 100, 20), createTier(100, null, 30)];

  it("keeps row order and does not touch the neighbor until linking is requested", () => {
    const original = tiers();
    const typed = updateTierBound(original, 0, "toPct", 1, false);
    expect(typed.map((t) => t.id)).toEqual(original.map((t) => t.id));
    expect(typed[0].toPct).toBe(1);
    expect(typed[1].fromPct).toBe(50);

    const committed = updateTierBound(original, 0, "toPct", 150, true);
    expect(committed.map((t) => t.id)).toEqual(original.map((t) => t.id));
    expect(committed[0].toPct).toBe(150);
    expect(committed[1].fromPct).toBe(150);
    expect(committed[2].fromPct).toBe(100);
  });

  it("does not reshuffle rows that are out of attainment order", () => {
    const scrambled = [createTier(100, 150, 30), createTier(0, 50, 10), createTier(50, 100, 20)];
    const next = updateTierBound(scrambled, 1, "toPct", 40, true);
    expect(next.map((t) => t.fromPct)).toEqual([100, 0, 40]);
    expect(next.map((t) => t.id)).toEqual(scrambled.map((t) => t.id));
  });
});
