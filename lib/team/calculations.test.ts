import { describe, it, expect } from "vitest";
import { calculateMemberValues, convertCurrency, calculateTeam } from "./calculations";
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
      ote: 10000,
      quotaType: "individual",
      quotaMultiple: 4,
    };

    const result = calculateMemberValues(member, 0);

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
      ote: 240000,
      quotaType: "individual",
      quotaMultiple: 3,
    };

    const result = calculateMemberValues(member, 0);

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
      ote: 20000,
      quotaType: "team",
      quotaMultiple: 4,
    };

    const teamOteMonthly = 50000;
    const result = calculateMemberValues(member, teamOteMonthly);

    expect(result.monthlyQuota).toBe(200000);
    expect(result.annualQuota).toBe(2400000);
  });

  it("should handle zero OTE", () => {
    const member: TeamMember = {
      id: "4",
      name: "Unpaid Intern",
      role: "Other",
      currency: "USD",
      payPeriod: "monthly",
      base: 0,
      ote: 0,
      quotaType: "individual",
      quotaMultiple: 4,
    };

    const result = calculateMemberValues(member, 0);

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
          ote: 340000,
          quotaType: "team",
          quotaMultiple: 4,
        },
        {
          id: "2",
          name: "CZ AE",
          role: "AE",
          currency: "CZK",
          payPeriod: "monthly",
          base: 85000,
          ote: 160000,
          quotaType: "individual",
          quotaMultiple: 4,
        },
        {
          id: "3",
          name: "US AE",
          role: "AE",
          currency: "USD",
          payPeriod: "monthly",
          base: 6000,
          ote: 8000,
          quotaType: "individual",
          quotaMultiple: 4,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = calculateTeam(team, "CZK");

    expect(result.members).toHaveLength(3);

    const headOfSales = result.members[0];
    expect(headOfSales.monthlyBase).toBe(170000);
    expect(headOfSales.monthlyOte).toBe(340000);
    expect(headOfSales.monthlyVariable).toBe(170000);
    expect(headOfSales.monthlyQuota).toBe(2736000);
    expect(headOfSales.annualQuota).toBe(32832000);
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
  });

  it("should handle annual pay periods", () => {
    const team: TeamDefinition = {
      id: "team2",
      name: "Annual Team",
      defaultQuotaMultiple: 4,
      fxRates: {},
      members: [
        {
          id: "1",
          name: "Annual AE",
          role: "AE",
          currency: "USD",
          payPeriod: "annual",
          base: 100000,
          ote: 200000,
          quotaType: "individual",
          quotaMultiple: 4,
        },
      ],
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
