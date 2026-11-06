import { describe, expect, it } from "vitest";
import type { Activity } from "./activities";
import { activityNote, activityText, controlText, insideFunds, movesText, ownershipText, weightText, whatIf } from "./details";
import type { CompanyExposure, FundSummary } from "./lookthrough";

const money = (value: number) => `$${value.toFixed(2)}`;

function company(direct: number, directUnits: number, byFund: [string, number][]): CompanyExposure {
  const throughFunds = byFund.reduce((sum, [, value]) => sum + value, 0);
  return {
    key: "TSLA|US",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    direct,
    directUnits,
    throughFunds,
    total: direct + throughFunds,
    percent: 0,
    viaFunds: byFund.map(([symbol]) => symbol),
    byFund: byFund.map(([symbol, value]) => ({ symbol, value })),
  };
}

// Your Sandbox: 8 Tesla shares at $240, plus Tesla inside $8,373.75 of SPY.
const tesla = company(1920, 8, [["SPY", 137.04]]);
const nvidia = { ...company(0, 0, [["SPY", 611.44]]), name: "NVIDIA Corp" };
const spy: FundSummary = { symbol: "SPY", name: "SPDR", value: 8373.75, asOf: "2026-11-04", otherWeight: 0, unopenedWeight: 0 };

describe("company dropdown", () => {
  it("says how much more you own than your brokerage shows", () => {
    expect(ownershipText(tesla, money)).toBe(
      "Your brokerage shows $1920.00 (8 shares). Counting your funds, you own $2057.04, which is 7.1% more.",
    );
    expect(ownershipText(nvidia, money)).toBe(
      "You don't own NVIDIA directly, so your brokerage doesn't list it. All $611.44 is inside your funds.",
    );
    expect(ownershipText(company(500, 1, []), money)).toContain("You own 1 share directly");
  });

  it("works out the weight inside each fund from the dollars: $137.04 of $8,373.75 is 1.64%", () => {
    const [inSpy] = insideFunds(tesla, [spy]);
    expect(inSpy.symbol).toBe("SPY");
    expect(weightText(inSpy.weight)).toBe("1.64%");
    expect(weightText(0.25)).toBe("25.0%");
    // FXAIX borrows SPY's list, so its weight matches SPY's. The dropdown says so.
    const fxaix: FundSummary = { ...spy, symbol: "FXAIX", value: 22324.6, approximatedBy: "SPY" };
    const both = { ...tesla, byFund: [{ symbol: "SPY", value: 137.04 }, { symbol: "FXAIX", value: 365.36 }] };
    const [, inFxaix] = insideFunds(both, [spy, fxaix]);
    expect(inFxaix.approximatedBy).toBe("SPY");
    expect(weightText(inFxaix.weight)).toBe("1.64%");
    expect(weightText(0.00004)).toBe("under 0.01%");
  });

  it("moves every dollar of the company: a 20% fall on $2,057.04 is $411.41", () => {
    expect(whatIf(tesla, 43851.25, -0.2).change).toBeCloseTo(-411.41, 2);
    // Same size up or down, so the slider only needs the size of the move.
    expect(whatIf(tesla, 43851.25, 0.2).change).toBeCloseTo(411.41, 2);
    // It names both parts, because both move together: $1,920 × 20% = $384 and $137.04 × 20% = $27.41.
    expect(movesText(tesla, 43851.25, 0.2, money)).toBe(
      "Up or down, that's $384.00 on the shares you bought and $27.41 inside SPY. Together, your holdings move about $411.41 (0.9%).",
    );
    expect(movesText(nvidia, 43851.25, 0.1, money)).toBe(
      "Up or down, that's $61.14 inside SPY. Together, your holdings move about $61.14 (0.1%).",
    );
    expect(movesText(tesla, 43851.25, 0, money)).toBe("No move, no change.");
  });

  it("says which part you control, without telling you what to do", () => {
    expect(controlText(tesla, money)).toBe(
      "You control the $1920.00 in your own shares. The $137.04 inside SPY changes only when you buy or sell SPY.",
    );
    expect(controlText(nvidia, money)).toBe("It changes only when you buy or sell SPY, or when it changes what it holds.");
    for (const text of [controlText(tesla, money), controlText(nvidia, money)]) {
      expect(text).not.toMatch(/should|recommend|consider/i);
    }
  });

  it("always says something about activity, with how far back the history goes", () => {
    const date = (iso: string) => iso;
    // Tesla is also inside SPY, so the note says SPY's own trades aren't shown.
    expect(activityNote(tesla, 0, "2026-09-16", [], date).note).toBe(
      "No trades or dividends for Tesla since 2026-09-16, the earliest date SnapTrade has for your accounts. What SPY buys and sells inside itself isn't shown.",
    );
    expect(activityNote(company(500, 1, []), 0, "2026-09-16", [], date).note).toBe(
      "No trades or dividends for Tesla since 2026-09-16, the earliest date SnapTrade has for your accounts.",
    );
    expect(activityNote(nvidia, 0, "2026-09-16", [], date).note).toBe(
      "You haven't traded NVIDIA directly since 2026-09-16. What SPY buys and sells inside itself isn't shown.",
    );
    expect(activityNote(tesla, 1, "2026-09-16", [], date).note).toBe(
      "History from 2026-09-16. What SPY buys and sells inside itself isn't shown.",
    );
    // No date from SnapTrade: don't invent one.
    expect(activityNote(tesla, 0, undefined, [], date).note).toBe(
      "No trades or dividends for Tesla in the history SnapTrade has. What SPY buys and sells inside itself isn't shown.",
    );
    const directOnly = company(500, 1, []);
    expect(activityNote(directOnly, 1, "2026-09-16", [], date).note).toBe("History from 2026-09-16.");
    expect(activityNote(directOnly, 1, undefined, [], date).note).toBeUndefined();
  });

  it("warns when an account's activity didn't load", () => {
    expect(activityNote(tesla, 0, "2026-09-16", ["IRA"], (iso) => iso).warning).toBe(
      "Couldn't load activity for IRA, so some trades may be missing.",
    );
  });

  it("describes trades and dividends in plain words", () => {
    const base: Activity = { date: "2026-10-10", kind: "sell", units: 5, price: 240, amount: 1200, currency: "USD" };
    expect(activityText(base, money)).toBe("Sold 5 shares for $1200.00 ($240.00 each)");
    expect(activityText({ ...base, kind: "buy", units: 1, amount: 240 }, money)).toBe("Bought 1 share for $240.00 ($240.00 each)");
    // The cash amount is SnapTrade's, so it shows even when it isn't shares × price, like after a fee.
    expect(activityText({ ...base, kind: "buy", units: 3, price: 495.2, amount: 1000 }, money)).toBe(
      "Bought 3 shares for $1000.00 ($495.20 each)",
    );
    // No amount from SnapTrade: fall back to shares × price.
    expect(activityText({ ...base, kind: "buy", units: 2, amount: 0 }, money)).toBe("Bought 2 shares for $480.00 ($240.00 each)");
    expect(activityText({ ...base, kind: "dividend", amount: 12.5 }, money)).toBe("Dividend of $12.50");
    expect(activityText({ ...base, kind: "reinvested", units: 0.0692 }, money)).toBe("Reinvested a dividend in 0.0692 shares");
    expect(activityText({ ...base, kind: "stockDividend", units: 2 }, money)).toBe("Stock dividend of 2 shares");
  });
});
