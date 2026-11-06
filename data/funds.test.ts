import { describe, expect, it } from "vitest";
import { FUNDS } from "./funds";

describe("fund snapshot", () => {
  it("has weights that add up to 100% for every fund", () => {
    for (const fund of Object.values(FUNDS)) {
      const total = fund.holdings.reduce((sum, h) => sum + h.weight, fund.other);
      expect(total, fund.symbol).toBeCloseTo(1, 6);
      expect(fund.other, fund.symbol).toBeGreaterThanOrEqual(0);
    }
  });

  it("has a date on every fund, so the UI can show how old the data is", () => {
    for (const fund of Object.values(FUNDS)) {
      expect(fund.asOf, fund.symbol).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("lists holdings largest first", () => {
    for (const fund of Object.values(FUNDS)) {
      const weights = fund.holdings.map((h) => h.weight);
      expect(weights, fund.symbol).toEqual([...weights].sort((a, b) => b - a));
    }
  });

  it("marks FXAIX as using SPY's list", () => {
    expect(FUNDS.FXAIX.approximatedBy).toBe("SPY");
    expect(FUNDS.FXAIX.holdings).toEqual(FUNDS.SPY.holdings);
  });

  // XEQT's file is BlackRock's look-through, and XIC's is a separate file. XEQT puts
  // about a quarter of its money in Canada through XIC, so Royal Bank's weight in
  // XEQT should be about a quarter of its weight in XIC. On 2026-11-04: 2.02% / 7.84%.
  it("agrees with XIC's file on Royal Bank: XEQT holds about a quarter as much", () => {
    const inXeqt = FUNDS.XEQT.holdings.find((h) => h.symbol === "RY")!.weight;
    const inXic = FUNDS.XIC.holdings.find((h) => h.symbol === "RY")!.weight;
    expect(inXeqt / inXic).toBeGreaterThan(0.2);
    expect(inXeqt / inXic).toBeLessThan(0.3);
  });

  it("keeps every holding, so almost nothing is left as other", () => {
    expect(FUNDS.SPY.holdings.length).toBeGreaterThan(490);
    for (const fund of Object.values(FUNDS)) expect(fund.other, fund.symbol).toBeLessThan(0.02);
  });
});
