import { describe, expect, it } from "vitest";
import type { Activity } from "../../portfolio/activities/activities";
import {
  activityNote,
  activityText,
  controlText,
  insideFunds,
  movesParts,
  movesText,
  ownershipLabel,
  ownershipText,
  signedMoney,
  weightText,
  whatIf,
} from "./details";
import type { CompanyExposure, FundSummary } from "../../analysis/lookthrough/lookthrough";

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
const spy: FundSummary = { symbol: "SPY", name: "SPDR", value: 8373.75, asOf: "2026-11-04", nonCompanyWeight: 0, unopenedWeight: 0 };

describe("company dropdown", () => {
  it("says how much more you own than your brokerage shows", () => {
    expect(ownershipText(tesla, money)).toBe(
      "You bought $1920.00 (8 shares) directly. Your funds add $137.04, 7.1% more than your brokerage shows.",
    );
    expect(ownershipText(nvidia, money)).toBe(
      "You don't own NVIDIA shares directly, so your brokerage doesn't list it. All of it comes through SPY.",
    );
    expect(ownershipText(company(0, 0, [["SPY", 1], ["XEQT", 1]]), money)).toContain("comes through 2 funds");
    expect(ownershipText(company(500, 1, []), money)).toBe("All of it is the 1 share you bought. None of the funds we can see hold Tesla.");
    expect([tesla, nvidia, company(500, 1, [])].map(ownershipLabel)).toEqual(["Direct + funds", "Through funds only", "Direct only"]);
  });

  it("works out the weight inside each fund from the dollars: $137.04 of $8,373.75 is 1.64%", () => {
    const [inSpy] = insideFunds(tesla, [spy]);
    expect(inSpy.symbol).toBe("SPY");
    expect(weightText(inSpy.weight)).toBe("1.64%");
    expect(weightText(0.25)).toBe("25.0%");
    // FXAIX borrows SPY's list, so its weight matches SPY's. The dropdown says so.
    const fxaix: FundSummary = { ...spy, symbol: "FXAIX", value: 22324.6, approximatedBy: "SPY" };
    const both = { ...tesla, byFund: [{ symbol: "SPY", value: 137.04 }, { symbol: "FXAIX", value: 365.36 }] };
    // Biggest first: FXAIX's $365.36 comes before SPY's $137.04.
    const [inFxaix, inSpyToo] = insideFunds(both, [spy, fxaix]);
    expect(inSpyToo.symbol).toBe("SPY");
    // The bar is the fund's share of the company's total: $137.04 of $2,057.04 is 6.7%.
    expect(inSpy.shareOfCompany).toBeCloseTo(137.04 / 2057.04, 4);
    expect(inFxaix.approximatedBy).toBe("SPY");
    expect(weightText(inFxaix.weight)).toBe("1.64%");
    expect(weightText(0.00004)).toBe("under 0.01%");
  });

  it("moves every dollar of the company: a 20% fall on $2,057.04 is $411.41", () => {
    expect(whatIf(tesla, 43851.25, -0.2).change).toBeCloseTo(-411.41, 2);
    expect(whatIf(tesla, 43851.25, 0.2).change).toBeCloseTo(411.41, 2);
    // A fall says "lose" and a minus sign, never "up or down".
    expect(movesText(tesla, 43851.25, 0.2, money)).toBe(
      "For a 20% rise in Tesla's price, your holdings would gain about $411.41 (+0.94%).",
    );
    expect(movesText(tesla, 43851.25, -0.2, money)).toBe(
      "For a 20% fall in Tesla's price, your holdings would lose about $411.41 (−0.94%).",
    );
    expect(movesText(tesla, 43851.25, 0, money)).toBe("No move, no change.");
    // It names both parts, because both move together: $1,920 × 20% = $384 and $137.04 × 20% = $27.41.
    expect(movesParts(tesla, -0.2, money)).toBe("−$384.00 on the shares you bought, −$27.41 inside SPY.");
    expect(movesParts(nvidia, 0.1, money)).toBeUndefined(); // One part: the big number already says it.
    expect(signedMoney(61.14, money)).toBe("+$61.14");
    expect(signedMoney(0, money)).toBe("$0.00");
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
      "No Tesla trades or dividends since 2026-09-16. Trades inside your funds aren't included.",
    );
    expect(activityNote(company(500, 1, []), 0, "2026-09-16", [], date).note).toBe(
      "No Tesla trades or dividends since 2026-09-16.",
    );
    expect(activityNote(nvidia, 0, "2026-09-16", [], date).note).toBe(
      "No direct NVIDIA trades since 2026-09-16. Trades inside your funds aren't included.",
    );
    expect(activityNote(tesla, 1, "2026-09-16", [], date).note).toBe(
      "History from 2026-09-16. Trades inside your funds aren't included.",
    );
    // No date from SnapTrade: don't invent one.
    expect(activityNote(tesla, 0, undefined, [], date).note).toBe(
      "No Tesla trades or dividends in the history SnapTrade has. Trades inside your funds aren't included.",
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
