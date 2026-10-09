import { describe, it, expect } from "vitest";
import {
  calculateMemberValues,
  convertCurrency,
  calculateTeam,
  calculateTeamScenario,
  calculateVariablePayout,
  calculateAttainmentScenarios,
  calculateArrPayout,
  calculateArrPayoutComparison,
} from "./calculations";
import {
  deserializeTeam,
  mergeImportedTeam,
  TEAM_EXPORT_FORMAT,
  TEAM_SCHEMA_VERSION,
} from "./export";
import type { TeamMember, TeamDefinition } from "./types";

describe("calculateMemberValues", () => {
  it("should calculate derived values for monthly pay period", () => {
    const member: TeamMember = {
      id: "1",
      name: "Test AE",
      role: "AE",
      currency: "USD",
      payPeriod: "monthly",
      base: 5000,
      targetVariable: 5000,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
      payoutBasis: "individual",
    };

    const result = calculateMemberValues(member);

    expect(result.variable).toBe(5000);
    expect(result.basePct).toBe(50);
    expect(result.variablePct).toBe(50);
    expect(result.monthlyBase).toBe(5000);
    expect(result.monthlyOte).toBe(10000);
    expect(result.monthlyVariable).toBe(5000);
    expect(result.annualBase).toBe(60000);
    expect(result.annualOte).toBe(120000);
    expect(result.annualVariable).toBe(60000);
    expect(result.monthlyQuota).toBe(40000);
    expect(result.annualQuota).toBe(480000);
  });

  it("should calculate derived values for annual pay period", () => {
    const member: TeamMember = {
      id: "2",
      name: "Test Manager",
      role: "Head of Sales",
      currency: "USD",
      payPeriod: "annual",
      base: 120000,
      targetVariable: 120000,
      quotaMode: "multiple",
      quotaMultiple: 3,
      reportsToMemberId: null,
      payoutBasis: "individual",
    };

    const result = calculateMemberValues(member);

    expect(result.variable).toBe(120000);
    expect(result.basePct).toBe(50);
    expect(result.variablePct).toBe(50);
    expect(result.monthlyBase).toBe(10000);
    expect(result.monthlyOte).toBe(20000);
    expect(result.monthlyVariable).toBe(10000);
    expect(result.annualBase).toBe(120000);
    expect(result.annualOte).toBe(240000);
    expect(result.annualVariable).toBe(120000);
    expect(result.monthlyQuota).toBe(60000);
    expect(result.annualQuota).toBe(720000);
  });

  it("should calculate team quota correctly", () => {
    const member: TeamMember = {
      id: "3",
      name: "Head of Sales",
      role: "Head of Sales",
      currency: "USD",
      payPeriod: "monthly",
      base: 10000,
      targetVariable: 10000,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
      payoutBasis: "team",
    };

    const result = calculateMemberValues(member);

    expect(result.monthlyQuota).toBe(80000);
    expect(result.annualQuota).toBe(960000);
  });

  it("should handle zero OTE", () => {
    const member: TeamMember = {
      id: "4",
      name: "Unpaid Intern",
      role: "Other",
      currency: "USD",
      payPeriod: "monthly",
      base: 0,
      targetVariable: 0,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
      payoutBasis: "individual",
    };

    const result = calculateMemberValues(member);

    expect(result.variable).toBe(0);
    expect(result.basePct).toBe(0);
    expect(result.variablePct).toBe(0);
    expect(result.monthlyQuota).toBe(0);
  });
});

describe("convertCurrency", () => {
  const fxRates = {
    "USD/CZK": 23,
    "EUR/CZK": 25,
  };

  it("should return same amount for same currency", () => {
    expect(convertCurrency(100, "USD", "USD", fxRates)).toBe(100);
  });

  it("should convert using direct rate", () => {
    expect(convertCurrency(100, "USD", "CZK", fxRates)).toBe(2300);
  });

  it("should convert using inverse rate", () => {
    expect(convertCurrency(2300, "CZK", "USD", fxRates)).toBe(100);
  });

  it("should return original amount if no rate available", () => {
    expect(convertCurrency(100, "USD", "GBP", fxRates)).toBe(100);
  });
});

describe("calculateTeam", () => {
  it("should calculate totals for mixed team", () => {
    const team: TeamDefinition = {
      id: "team1",
      name: "Sales Team 2027",
      defaultQuotaMultiple: 4,
      defaultThresholdPct: 50,
      defaultAccelerator: 1.5,
      defaultCapPct: null,
      fxRates: {
        "USD/CZK": 23,
      },
      members: [
        {
          id: "1",
          name: "Head of Sales",
          role: "Head of Sales",
          currency: "CZK",
          payPeriod: "monthly",
          base: 170000,
          targetVariable: 170000,
          quotaMode: "multiple",
          quotaMultiple: 4,
          reportsToMemberId: null,
          payoutBasis: "team",
        },
        {
          id: "2",
          name: "CZ AE",
          role: "AE",
          currency: "CZK",
          payPeriod: "monthly",
          base: 85000,
          targetVariable: 75000,
          quotaMode: "multiple",
          quotaMultiple: 4,
          reportsToMemberId: null,
          payoutBasis: "individual",
        },
        {
          id: "3",
          name: "US AE",
          role: "AE",
          currency: "USD",
          payPeriod: "monthly",
          base: 6000,
          targetVariable: 2000,
          quotaMode: "multiple",
          quotaMultiple: 4,
          reportsToMemberId: null,
          payoutBasis: "individual",
        },
      ],
      scenarios: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = calculateTeam(team, "CZK");

    expect(result.members).toHaveLength(3);

    const headOfSales = result.members[0];
    expect(headOfSales.monthlyBase).toBe(170000);
    expect(headOfSales.monthlyOte).toBe(340000);
    expect(headOfSales.monthlyVariable).toBe(170000);
    expect(headOfSales.monthlyQuota).toBe(1360000);
    expect(headOfSales.annualQuota).toBe(16320000);
    expect(headOfSales.quotaCurrency).toBe("CZK");

    const czAe = result.members[1];
    expect(czAe.monthlyBase).toBe(85000);
    expect(czAe.monthlyOte).toBe(160000);
    expect(czAe.monthlyVariable).toBe(75000);
    expect(czAe.monthlyQuota).toBe(640000);
    expect(czAe.annualQuota).toBe(7680000);

    const usAe = result.members[2];
    expect(usAe.monthlyBase).toBe(6000);
    expect(usAe.monthlyOte).toBe(8000);
    expect(usAe.monthlyVariable).toBe(2000);
    expect(usAe.monthlyQuota).toBe(32000);
    expect(usAe.annualQuota).toBe(384000);

    expect(result.totals.reportingCurrency).toBe("CZK");
    expect(result.totals.totalMonthlyOte).toBe(684000);
    expect(result.totals.teamMonthlyQuota).toBe(2736000);
    expect(result.totals.teamAnnualQuota).toBe(32832000);
    expect(result.totals.totalMonthlyQuota).toBe(2736000);
    expect(result.totals.totalAnnualQuota).toBe(32832000);
  });

  it("should handle annual pay periods", () => {
    const team: TeamDefinition = {
      id: "team2",
      name: "Annual Team",
      defaultQuotaMultiple: 4,
      defaultThresholdPct: 50,
      defaultAccelerator: 1.5,
      defaultCapPct: null,
      fxRates: {},
      members: [
        {
          id: "1",
          name: "Annual AE",
          role: "AE",
          currency: "USD",
          payPeriod: "annual",
          base: 100000,
          targetVariable: 100000,
          quotaMode: "multiple",
          quotaMultiple: 4,
          reportsToMemberId: null,
          payoutBasis: "individual",
        },
      ],
      scenarios: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = calculateTeam(team, "USD");
    const member = result.members[0];

    expect(member.monthlyBase).toBeCloseTo(8333.33, 2);
    expect(member.monthlyOte).toBeCloseTo(16666.67, 2);
    expect(member.annualBase).toBe(100000);
    expect(member.annualOte).toBe(200000);
    expect(member.annualQuota).toBe(800000);
  });
});

describe("team commission scenarios", () => {
  const team: TeamDefinition = {
    id: "synthetic",
    name: "Synthetic team",
    defaultQuotaMultiple: 4,
    defaultThresholdPct: 50,
    defaultAccelerator: 2,
    defaultCapPct: 150,
    fxRates: { "EUR/USD": 2 },
    members: [
      {
        id: "ae",
        name: "AE",
        role: "AE",
        currency: "USD",
        payPeriod: "annual",
        base: 60000,
        targetVariable: 40000,
        quotaMode: "multiple",
        quotaMultiple: 4,
        reportsToMemberId: null,
        payoutBasis: "individual",
      },
      {
        id: "manager",
        name: "Manager",
        role: "Manager",
        currency: "EUR",
        payPeriod: "annual",
        base: 40000,
        targetVariable: 20000,
        quotaMode: "multiple",
        quotaMultiple: 4,
        reportsToMemberId: null,
        payoutBasis: "team",
        thresholdPct: 25,
        accelerator: 1,
        capPct: 125,
      },
    ],
    scenarios: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("pays only base below threshold and zero variable at threshold", () => {
    expect(calculateVariablePayout(40000, 40, { thresholdPct: 50, accelerator: 2, capPct: null })).toBe(0);
    expect(calculateVariablePayout(40000, 50, { thresholdPct: 50, accelerator: 2, capPct: null })).toBe(0);
  });

  it("pays full variable at 100%, including when threshold is 100%", () => {
    const rules = { thresholdPct: 50, accelerator: 2, capPct: 150 };
    expect(calculateVariablePayout(40000, 100, rules)).toBe(40000);
    expect(calculateVariablePayout(40000, 125, rules)).toBe(60000);
    expect(calculateVariablePayout(40000, 200, rules)).toBe(80000);
    expect(calculateVariablePayout(40000, 99, { thresholdPct: 100, accelerator: 2, capPct: null })).toBe(0);
    expect(calculateVariablePayout(40000, 100, { thresholdPct: 100, accelerator: 2, capPct: null })).toBe(40000);
  });

  it("uses team attainment for a team-quota manager and converts total cost", () => {
    const scenario = calculateTeamScenario(team, "USD", 100);
    expect(scenario.members[1].attainmentPct).toBe(100);
    expect(scenario.members[1].variablePayout).toBe(1666.67);
    expect(scenario.totalCost).toBe(18333.33);
    expect(scenario.generatedArr).toBe(880000);
    expect(scenario.arrCostRatio).toBe(4);
  });
});

describe("hierarchy quota aggregation", () => {
  const hierarchyTeam: TeamDefinition = {
    id: "hierarchy",
    name: "Hierarchy",
    defaultQuotaMultiple: 4,
    defaultThresholdPct: 0,
    defaultAccelerator: 1,
    defaultCapPct: null,
    fxRates: { "EUR/USD": 2 },
    members: [
      {
        id: "root",
        name: "Root",
        role: "Manager",
        currency: "USD",
        payPeriod: "monthly",
        base: 100,
        targetVariable: 100,
        quotaMode: "direct",
        directQuota: 100,
        reportsToMemberId: null,
        payoutBasis: "team",
      },
      {
        id: "child",
        name: "Child",
        role: "AE",
        currency: "EUR",
        payPeriod: "annual",
        base: 1200,
        targetVariable: 1200,
        quotaMode: "direct",
        directQuota: 1200,
        reportsToMemberId: "root",
        payoutBasis: "individual",
      },
      {
        id: "grandchild",
        name: "Grandchild",
        role: "AE",
        currency: "USD",
        payPeriod: "monthly",
        base: 50,
        targetVariable: 50,
        quotaMode: "multiple",
        quotaMultiple: 3,
        reportsToMemberId: "child",
        payoutBasis: "individual",
      },
      {
        id: "second-root",
        name: "Second root",
        role: "AE",
        currency: "USD",
        payPeriod: "monthly",
        base: 25,
        targetVariable: 25,
        quotaMode: "direct",
        directQuota: 50,
        reportsToMemberId: null,
        payoutBasis: "individual",
      },
    ],
    scenarios: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  it("aggregates descendants in reporting currency and sums roots once", () => {
    const result = calculateTeam(hierarchyTeam, "USD");
    const root = result.members.find((member) => member.memberId === "root");
    const child = result.members.find((member) => member.memberId === "child");

    expect(child?.aggregateMonthlyQuota).toBe(500);
    expect(child?.aggregateAnnualQuota).toBe(6000);
    expect(root?.aggregateMonthlyQuota).toBe(600);
    expect(root?.aggregateAnnualQuota).toBe(7200);
    expect(result.totals.teamMonthlyQuota).toBe(650);
    expect(result.totals.teamAnnualQuota).toBe(7800);
  });

  it("uses member-specific attainment and sums own quotas for annual ARR", () => {
    const scenario = calculateTeamScenario(hierarchyTeam, "USD", {
      id: "named",
      name: "Named",
      attainmentByMemberId: {
        root: 50,
        child: 100,
        grandchild: 150,
        "second-root": 100,
      },
    });

    expect(scenario.scenarioName).toBe("Named");
    expect(scenario.attainmentPct).toBeNull();
    expect(scenario.members.map((member) => member.variablePayout)).toEqual([116.67, 100, 75, 25]);
    expect(scenario.totalCost).toBe(791.67);
    expect(scenario.generatedArr).toBe(9000);
    expect(scenario.arrCostRatio).toBe(0.95);
  });

  it("measures team-basis payout on mixed subtree attainment, not a manager label", () => {
    const mixed: TeamDefinition = {
      id: "mixed",
      name: "Mixed",
      defaultQuotaMultiple: 1,
      defaultThresholdPct: 0,
      defaultAccelerator: 1,
      defaultCapPct: null,
      fxRates: { "USD/CZK": 20 },
      members: [
        {
          id: "head",
          name: "Head",
          role: "Head of Sales",
          currency: "CZK",
          payPeriod: "monthly",
          base: 100,
          targetVariable: 100,
          quotaMode: "multiple",
          quotaMultiple: 1,
          reportsToMemberId: null,
          payoutBasis: "team",
        },
        {
          id: "cz",
          name: "CZ AE",
          role: "AE",
          currency: "CZK",
          payPeriod: "monthly",
          base: 50,
          targetVariable: 50,
          quotaMode: "multiple",
          quotaMultiple: 1,
          reportsToMemberId: "head",
          payoutBasis: "individual",
        },
        {
          id: "us",
          name: "US AE",
          role: "AE",
          currency: "USD",
          payPeriod: "monthly",
          base: 10,
          targetVariable: 10,
          quotaMode: "multiple",
          quotaMultiple: 1,
          reportsToMemberId: "head",
          payoutBasis: "individual",
        },
      ],
      scenarios: [],
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };

    const scenario = calculateTeamScenario(mixed, "CZK", {
      id: "mixed",
      name: "Mixed",
      attainmentByMemberId: { head: 100, cz: 50, us: 150 },
    });
    const head = scenario.members.find((member) => member.memberId === "head");
    const cz = scenario.members.find((member) => member.memberId === "cz");
    const us = scenario.members.find((member) => member.memberId === "us");

    expect(cz?.variablePayout).toBe(25);
    expect(us?.variablePayout).toBe(15);
    expect(head?.attainmentPct).toBeCloseTo(121.4286, 3);
    expect(head?.variablePayout).toBe(121.43);
    expect(scenario.generatedArr).toBe(10200);
  });

  it("builds a uniform attainment range table", () => {
    const rows = calculateAttainmentScenarios(hierarchyTeam, "USD", 0, 20, 10);
    expect(rows.map((row) => row.attainmentPct)).toEqual([0, 10, 20]);
    expect(rows[2]?.members.every((member) => member.attainmentPct === 20)).toBe(true);
  });

  it("includes the range end when the step does not land on it", () => {
    const rows = calculateAttainmentScenarios(hierarchyTeam, "USD", 0, 195, 10);
    expect(rows.map((row) => row.attainmentPct)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 195,
    ]);
  });

  it("breaks reporting cycles safely without dropping quota", () => {
    const cyclic: TeamDefinition = {
      ...hierarchyTeam,
      members: [
        { ...hierarchyTeam.members[0], id: "a", reportsToMemberId: "b", directQuota: 10 },
        { ...hierarchyTeam.members[0], id: "b", reportsToMemberId: "a", directQuota: 20 },
      ],
    };

    const result = calculateTeam(cyclic, "USD");
    expect(new Set(result.hierarchyCycleMemberIds)).toEqual(new Set(["a", "b"]));
    expect(result.totals.teamMonthlyQuota).toBe(30);
    expect(result.totals.teamAnnualQuota).toBe(360);
  });
});

describe("team import compatibility", () => {
  it("defaults older JSON and preserves current FX rates while imported rates win conflicts", () => {
    const legacy = JSON.stringify({
      id: "legacy",
      name: "Legacy",
      defaultQuotaMultiple: 4,
      fxRates: { "USD/CZK": 24 },
      members: [],
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    });
    const parsed = deserializeTeam(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.team.defaultThresholdPct).toBe(0);
    expect(parsed.team.defaultAccelerator).toBe(1);
    expect(parsed.team.defaultCapPct).toBeNull();

    const merged = mergeImportedTeam(parsed.team, { "EUR/CZK": 25, "USD/CZK": 23 });
    expect(merged.fxRates).toEqual({ "EUR/CZK": 25, "USD/CZK": 24 });
  });

  it("migrates legacy compensation, quota, hierarchy, rules, and scenarios", () => {
    const parsed = deserializeTeam(JSON.stringify({
      id: "legacy-members",
      name: "Legacy members",
      defaultQuotaMultiple: 4,
      fxRates: {},
      members: [
        {
          id: "manager",
          name: "Manager",
          role: "Manager",
          currency: "USD",
          payPeriod: "monthly",
          base: 5000,
          ote: 10000,
          quotaType: "team",
          quotaMultiple: 4,
        },
        {
          id: "rep",
          name: "Rep",
          role: "AE",
          currency: "EUR",
          payPeriod: "annual",
          base: 60000,
          ote: 90000,
          quotaType: "individual",
          quotaMultiple: 3,
        },
      ],
    }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.team).toMatchObject({
      defaultThresholdPct: 0,
      defaultAccelerator: 1,
      defaultCapPct: null,
    });
    expect(parsed.team.members[0]).toMatchObject({
      targetVariable: 5000,
      quotaMode: "multiple",
      quotaMultiple: 4,
      reportsToMemberId: null,
      payoutBasis: "team",
    });
    expect(parsed.team.members[0].directQuota).toBeUndefined();
    expect(calculateMemberValues(parsed.team.members[0]).monthlyQuota).toBe(40000);
    expect(parsed.team.members[1]).toMatchObject({
      targetVariable: 30000,
      quotaMode: "multiple",
      quotaMultiple: 3,
      reportsToMemberId: "manager",
      payoutBasis: "individual",
    });
    expect(parsed.team.members[1].directQuota).toBeUndefined();
    expect(parsed.team.scenarios.map((scenario) => scenario.name)).toEqual([
      "Downside",
      "Plan",
      "Upside",
    ]);
    expect(parsed.team.scenarios.map((scenario) => scenario.attainmentByMemberId)).toEqual([
      { manager: 50, rep: 50 },
      { manager: 100, rep: 100 },
      { manager: 150, rep: 150 },
    ]);
  });

  it("recovers targetVariable from legacy OTE when a previous migration stored 0", () => {
    const parsed = deserializeTeam(JSON.stringify({
      id: "legacy-zero-variable",
      name: "Legacy zero variable",
      members: [{
        id: "rep",
        name: "Rep",
        base: 85000,
        ote: 160000,
        targetVariable: 0,
        quotaType: "individual",
        quotaMultiple: 4,
      }],
    }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.team.members[0].targetVariable).toBe(75000);
  });

  it("clamps migrated variable compensation when legacy OTE is below base", () => {
    const parsed = deserializeTeam(JSON.stringify({
      id: "legacy-negative-variable",
      name: "Legacy negative variable",
      members: [{
        id: "rep",
        name: "Rep",
        base: 5000,
        ote: 4000,
        quotaType: "individual",
        quotaMultiple: 4,
      }],
    }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.team.members[0].targetVariable).toBe(0);
    expect(parsed.team.members[0].quotaMode).toBe("multiple");
    expect(parsed.team.members[0].quotaMultiple).toBe(4);
    expect(parsed.team.members[0].directQuota).toBeUndefined();
  });

  it("uses the first legacy team manager for unassigned reports when several exist", () => {
    const parsed = deserializeTeam(JSON.stringify({
      id: "legacy-multiple-managers",
      name: "Legacy multiple managers",
      defaultQuotaMultiple: 4,
      members: [
        {
          id: "manager-1",
          name: "First manager",
          base: 5000,
          ote: 10000,
          quotaType: "team",
          quotaMultiple: 4,
        },
        {
          id: "manager-2",
          name: "Second manager",
          base: 6000,
          ote: 12000,
          quotaType: "team",
          quotaMultiple: 3,
        },
        {
          id: "rep",
          name: "Rep",
          base: 4000,
          ote: 7000,
          quotaType: "individual",
          quotaMultiple: 5,
        },
      ],
    }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.team.members.map((member) => [member.id, member.reportsToMemberId])).toEqual([
      ["manager-1", null],
      ["manager-2", null],
      ["rep", "manager-1"],
    ]);
    expect(parsed.team.members.slice(0, 2).map((member) => ({
      quotaMode: member.quotaMode,
      quotaMultiple: member.quotaMultiple,
      directQuota: member.directQuota,
    }))).toEqual([
      { quotaMode: "multiple", quotaMultiple: 4, directQuota: undefined },
      { quotaMode: "multiple", quotaMultiple: 3, directQuota: undefined },
    ]);
  });

  it("rejects wrapped exports and raw teams from a newer schema", () => {
    const team = {
      id: "future",
      name: "Future team",
      members: [],
      schemaVersion: TEAM_SCHEMA_VERSION + 1,
    };
    const error = `This team file uses schema version ${TEAM_SCHEMA_VERSION + 1}, but this app supports up to version ${TEAM_SCHEMA_VERSION}.`;
    const wrapped = deserializeTeam(JSON.stringify({
      format: TEAM_EXPORT_FORMAT,
      schemaVersion: TEAM_SCHEMA_VERSION + 1,
      exportedAt: "2026-01-01",
      team,
    }));

    expect(wrapped).toEqual({ ok: false, error });
    expect(deserializeTeam(JSON.stringify(team))).toEqual({ ok: false, error });
  });
});

describe("payout by ARR", () => {
  const team: TeamDefinition = {
    id: "arr-team",
    name: "ARR team",
    defaultQuotaMultiple: 4,
    defaultThresholdPct: 50,
    defaultAccelerator: 3,
    defaultCapPct: 150,
    fxRates: { "USD/CZK": 20 },
    members: [
      {
        id: "cz",
        name: "CZ AE",
        role: "AE",
        currency: "CZK",
        payPeriod: "monthly",
        base: 10000,
        targetVariable: 10000,
        quotaMode: "multiple",
        quotaMultiple: 4,
        reportsToMemberId: "mgr",
        payoutBasis: "individual",
      },
      {
        id: "us",
        name: "US AE",
        role: "AE",
        currency: "USD",
        payPeriod: "monthly",
        base: 500,
        targetVariable: 500,
        quotaMode: "multiple",
        quotaMultiple: 4,
        reportsToMemberId: "mgr",
        payoutBasis: "individual",
      },
      {
        id: "mgr",
        name: "Manager",
        role: "Manager",
        currency: "CZK",
        payPeriod: "monthly",
        base: 20000,
        targetVariable: 20000,
        quotaMode: "multiple",
        quotaMultiple: 1,
        reportsToMemberId: null,
        payoutBasis: "team",
      },
    ],
    scenarios: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  it("pays no variable below or at threshold", () => {
    const below = calculateArrPayout(team, "CZK", "cz", 30000, "CZK", "monthly");
    const atThreshold = calculateArrPayout(team, "CZK", "cz", 40000, "CZK", "monthly");
    expect(below?.variablePayout).toBe(0);
    expect(below?.marginalRate).toBe(0);
    expect(atThreshold?.attainmentPct).toBe(50);
    expect(atThreshold?.variablePayout).toBe(0);
    expect(atThreshold?.marginalRate).toBe(0.25);
  });

  it("pays full variable at 100% and accelerates above it until the cap", () => {
    const atQuota = calculateArrPayout(team, "CZK", "cz", 80000, "CZK", "monthly");
    const accelerated = calculateArrPayout(team, "CZK", "cz", 100000, "CZK", "monthly");
    const atCap = calculateArrPayout(team, "CZK", "cz", 120000, "CZK", "monthly");
    const aboveCap = calculateArrPayout(team, "CZK", "cz", 160000, "CZK", "monthly");

    expect(atQuota?.variablePayout).toBe(10000);
    expect(atQuota?.total).toBe(20000);
    expect(atQuota?.effectiveRate).toBe(0.125);
    expect(atQuota?.marginalRate).toBe(0.375);
    expect(accelerated?.variablePayout).toBe(17500);
    expect(atCap?.variablePayout).toBe(25000);
    expect(aboveCap?.variablePayout).toBe(25000);
    expect(aboveCap?.marginalRate).toBe(0);
  });

  it("converts ARR from reporting currency into member attainment", () => {
    const usd = calculateArrPayout(team, "CZK", "cz", 4000, "USD", "monthly");
    expect(usd?.attainmentPct).toBe(100);
    expect(usd?.variablePayout).toBe(10000);
  });

  it("uses subtree ARR for a team-basis manager", () => {
    const atTeamQuota = calculateArrPayout(team, "CZK", "mgr", 200000, "CZK", "monthly");
    const below = calculateArrPayout(team, "CZK", "mgr", 90000, "CZK", "monthly");
    expect(atTeamQuota?.quota).toBe(200000);
    expect(atTeamQuota?.attainmentPct).toBe(100);
    expect(atTeamQuota?.variablePayout).toBe(20000);
    expect(below?.variablePayout).toBe(0);
  });

  it("compares the same reporting ARR across individual quotas only", () => {
    const rows = calculateArrPayoutComparison(team, "CZK", 80000, "monthly");
    expect(rows.map((row) => row.memberId)).toEqual(["cz", "us"]);
    expect(rows[0]?.attainmentPct).toBe(100);
    expect(rows[1]?.attainmentPct).toBe(100);
    expect(rows[0]?.variablePayout).toBe(10000);
    expect(rows[1]?.variablePayout).toBe(500);
  });

  it("does not round ARR just below quota or threshold up into the next band", () => {
    const tight: TeamDefinition = {
      ...team,
      defaultThresholdPct: 100,
      defaultAccelerator: 2,
      defaultCapPct: null,
      members: [{
        ...team.members[0],
        reportsToMemberId: null,
        base: 85000,
        targetVariable: 75000,
        quotaMultiple: 4,
      }],
    };

    const justBelowQuota = calculateArrPayout(tight, "CZK", "cz", 639999, "CZK", "monthly");
    expect(justBelowQuota?.quota).toBe(640000);
    expect(justBelowQuota?.attainmentPct).toBeLessThan(100);
    expect(justBelowQuota?.variablePayout).toBe(0);

    const atQuota = calculateArrPayout(tight, "CZK", "cz", 640000, "CZK", "monthly");
    expect(atQuota?.variablePayout).toBe(75000);

    const justBelowThreshold = calculateArrPayout(team, "CZK", "cz", 39999, "CZK", "monthly");
    expect(justBelowThreshold?.attainmentPct).toBeLessThan(50);
    expect(justBelowThreshold?.variablePayout).toBe(0);
  });
});
