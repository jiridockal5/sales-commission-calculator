import { afterEach, describe, expect, it, vi } from "vitest";
import { useTeamStore } from "@/store/teamStore";
import type { TeamDefinition } from "./types";

function makeTeam(): TeamDefinition {
  return {
    id: "team",
    name: "Team",
    defaultQuotaMultiple: 4,
    defaultThresholdPct: 0,
    defaultAccelerator: 1,
    defaultCapPct: null,
    fxRates: { "EUR/USD": 1.2 },
    members: [
      {
        id: "manager",
        name: "Manager",
        role: "Manager",
        currency: "USD",
        payPeriod: "monthly",
        base: 5000,
        targetVariable: 5000,
        quotaMode: "multiple",
        quotaMultiple: 4,
        reportsToMemberId: null,
        payoutBasis: "team",
      },
      {
        id: "rep",
        name: "Rep",
        role: "AE",
        currency: "EUR",
        payPeriod: "monthly",
        base: 3000,
        targetVariable: 2000,
        quotaMode: "direct",
        directQuota: 20000,
        reportsToMemberId: "manager",
        payoutBasis: "individual",
      },
      {
        id: "nested",
        name: "Nested rep",
        role: "SDR",
        currency: "USD",
        payPeriod: "monthly",
        base: 2000,
        targetVariable: 1000,
        quotaMode: "multiple",
        quotaMultiple: 3,
        reportsToMemberId: "rep",
        payoutBasis: "individual",
      },
    ],
    scenarios: [
      {
        id: "downside",
        name: "Downside",
        attainmentByMemberId: { manager: 50, rep: 50, nested: 50 },
      },
      {
        id: "plan",
        name: "Plan",
        attainmentByMemberId: { manager: 100, rep: 100, nested: 100 },
      },
      {
        id: "upside",
        name: "Upside",
        attainmentByMemberId: { manager: 150, rep: 150, nested: 150 },
      },
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

afterEach(() => {
  useTeamStore.setState({ hydrated: false, teams: [], activeTeamId: null });
  vi.unstubAllGlobals();
});

describe("team store hierarchy and scenarios", () => {
  it("makes direct reports roots and removes deleted members from scenarios", () => {
    const team = makeTeam();
    useTeamStore.setState({ hydrated: true, teams: [team], activeTeamId: team.id });

    useTeamStore.getState().deleteMember("manager");

    const updated = useTeamStore.getState().teams[0];
    expect(updated.members.map((member) => [member.id, member.reportsToMemberId])).toEqual([
      ["rep", null],
      ["nested", "rep"],
    ]);
    for (const scenario of updated.scenarios) {
      expect(scenario.attainmentByMemberId).not.toHaveProperty("manager");
      expect(Object.keys(scenario.attainmentByMemberId).sort()).toEqual(["nested", "rep"]);
    }
  });

  it("adds scenario defaults for new members and rejects reporting cycles", () => {
    const team = makeTeam();
    useTeamStore.setState({ hydrated: true, teams: [team], activeTeamId: team.id });

    useTeamStore.getState().addMember({
      name: "New rep",
      role: "AE",
      currency: "USD",
      payPeriod: "monthly",
      base: 1000,
      targetVariable: 1000,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
      payoutBasis: "individual",
    });

    let updated = useTeamStore.getState().teams[0];
    const newMember = updated.members.at(-1);
    expect(newMember).toBeDefined();
    expect(updated.scenarios.map((scenario) => scenario.attainmentByMemberId[newMember!.id]))
      .toEqual([50, 100, 150]);

    useTeamStore.getState().updateMember("manager", { reportsToMemberId: "nested" });
    updated = useTeamStore.getState().teams[0];
    expect(updated.members.find((member) => member.id === "manager")?.reportsToMemberId).toBeNull();
  });

  it("migrates legacy compensation and hierarchy during localStorage hydration", () => {
    const values = new Map<string, string>([
      ["sales-team-definitions", JSON.stringify([{
        id: "legacy",
        name: "Legacy",
        defaultQuotaMultiple: 4,
        members: [
          {
            id: "manager",
            name: "Manager",
            base: 5000,
            ote: 10000,
            quotaType: "team",
            quotaMultiple: 4,
          },
          {
            id: "rep",
            name: "Rep",
            base: 6000,
            ote: 9000,
            quotaType: "individual",
            quotaMultiple: 3,
          },
        ],
      }])],
    ]);
    const localStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    };
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", localStorage);

    useTeamStore.getState().hydrate();

    const hydrated = useTeamStore.getState().teams[0];
    expect(hydrated.members[0]).toMatchObject({
      id: "manager",
      targetVariable: 5000,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
    });
    expect(hydrated.members[1]).toMatchObject({
      id: "rep",
      targetVariable: 3000,
      quotaMode: "multiple",
      quotaMultiple: 3,
      reportsToMemberId: "manager",
    });
    expect(hydrated.members[1].directQuota).toBeUndefined();
    expect(JSON.parse(values.get("sales-team-definitions")!)[0].members)
      .toEqual(hydrated.members);
  });

  it("keeps an explicit override when an unrelated member field is updated", () => {
    const team = makeTeam();
    useTeamStore.setState({ hydrated: true, teams: [team], activeTeamId: team.id });

    useTeamStore.getState().updateMember("rep", { thresholdPct: 0 });
    useTeamStore.getState().updateMember("rep", { name: "Renamed rep" });
    const updated = useTeamStore.getState().teams[0].members.find((member) => member.id === "rep");
    expect(updated?.thresholdPct).toBe(0);
    expect(updated?.name).toBe("Renamed rep");
  });
});
