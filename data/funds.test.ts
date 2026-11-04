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

  // Independent check: BlackRock's own look-through table in the XEQT file, dated
  // 2026-11-02, puts Royal Bank at 2.01% of XEQT. XEQT only holds it through XIC.
  it("matches BlackRock's published Royal Bank weight inside XEQT", () => {
    const xic = FUNDS.XEQT.holdings.find((h) => h.symbol === "XIC")!;
    const ry = FUNDS.XIC.holdings.find((h) => h.symbol === "RY")!;
    expect(xic.weight * ry.weight).toBeCloseTo(0.0201, 3);
  });
});
