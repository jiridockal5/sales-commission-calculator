import { describe, it, expect } from "vitest";
import {
  calculateMemberValues,
  convertCurrency,
  calculateTeam,
  calculateTeamScenario,
  calculateVariablePayout,
} from "./calculations";
import { deserializeTeam, mergeImportedTeam } from "./export";
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

  it("pays full variable at 100%, accelerates above target, and applies cap", () => {
    const rules = { thresholdPct: 50, accelerator: 2, capPct: 150 };
    expect(calculateVariablePayout(40000, 100, rules)).toBe(40000);
    expect(calculateVariablePayout(40000, 125, rules)).toBe(60000);
    expect(calculateVariablePayout(40000, 200, rules)).toBe(80000);
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

  it("uses member-specific attainment and root attainment for annual ARR", () => {
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
    expect(scenario.members.map((member) => member.variablePayout)).toEqual([50, 100, 75, 25]);
    expect(scenario.totalCost).toBe(725);
    expect(scenario.generatedArr).toBe(4200);
    expect(scenario.arrCostRatio).toBe(0.48);
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
      targetVariable: 0,
      quotaMode: "direct",
      directQuota: 40000,
      reportsToMemberId: null,
      payoutBasis: "team",
    });
    expect(parsed.team.members[1]).toMatchObject({
      targetVariable: 0,
      quotaMode: "direct",
      directQuota: 270000,
      reportsToMemberId: null,
      payoutBasis: "individual",
    });
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
});
