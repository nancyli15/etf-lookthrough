import { describe, expect, it } from "vitest";
import { toHoldings, toNumber } from "./holdings";

// Same shape as a real /positions/all item, with strings for numbers.
function position(symbol: string, kind: string, units: string, price: string, currency = "USD", figi?: string) {
  return {
    instrument: {
      kind,
      symbol,
      description: `${symbol} name`,
      currency,
      figi_instrument: figi ? { figi_code: figi } : null,
    },
    units,
    price,
    currency,
  };
}

describe("toNumber", () => {
  it("converts numeric strings and leaves numbers alone", () => {
    expect(toNumber("180.5")).toBe(180.5);
    expect(toNumber(5)).toBe(5);
  });

  it("treats blank, non-numeric and missing values as unknown, not zero", () => {
    for (const v of ["", "  ", "abc", null, undefined]) expect(toNumber(v)).toBeNull();
  });
});

describe("toHoldings", () => {
  it("calculates value from string units and price", () => {
    const { holdings } = toHoldings([{ results: [position("AAPL", "stock", "5", "180.5", "USD", "F1")] }]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({ symbol: "AAPL", units: 5, price: 180.5, value: 902.5, figi: "F1" });
  });

  it("merges the same security across accounts", () => {
    const { holdings } = toHoldings([
      { results: [position("AAPL", "stock", "5", "100", "USD", "F1")] },
      { results: [position("AAPL", "stock", "3", "100", "USD", "F1")] },
    ]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({ units: 8, value: 800 });
  });

  it("keeps a security separate when the currency differs", () => {
    const { holdings } = toHoldings([
      { results: [position("AAPL", "stock", "1", "100", "USD", "F1")] },
      { results: [position("AAPL", "stock", "1", "140", "CAD", "F1")] },
    ]);
    expect(holdings.map((h) => h.value)).toEqual([100, 140]);
  });

  it("merges by symbol when there is no FIGI, as with crypto", () => {
    const { holdings } = toHoldings([
      { results: [position("BTC", "crypto", "1", "100")] },
      { results: [position("BTC", "crypto", "2", "100")] },
    ]);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].value).toBe(300);
  });

  it("marks crypto as not looked through, but not stocks or funds", () => {
    const { holdings } = toHoldings([
      {
        results: [
          position("BTC", "crypto", "1", "100"),
          position("AAPL", "stock", "1", "100", "USD", "F1"),
          position("SPY", "etf", "1", "100", "USD", "F2"),
          position("FXAIX", "mutualfund", "1", "100", "USD", "F3"),
        ],
      },
    ]);
    const reasons = Object.fromEntries(holdings.map((h) => [h.symbol, h.notLookedThrough]));
    expect(reasons.BTC).toContain("crypto");
    expect(reasons.AAPL).toBeUndefined();
    expect(reasons.SPY).toBeUndefined();
    expect(reasons.FXAIX).toBeUndefined();
  });

  it("reads kind in any capitalization", () => {
    const { holdings } = toHoldings([{ results: [position("SPY", "ETF", "1", "100", "USD", "F2")] }]);
    expect(holdings[0]).toMatchObject({ kind: "etf", notLookedThrough: undefined });
  });

  it("skips and reports a position with a blank price instead of valuing it at $0", () => {
    const result = toHoldings([{ results: [position("AAPL", "stock", "5", "")] }]);
    expect(result.holdings).toEqual([]);
    expect(result.skipped).toEqual(["AAPL"]);
  });

  it("returns nothing for empty or unexpected responses", () => {
    expect(toHoldings([])).toEqual({ holdings: [], skipped: [] });
    expect(toHoldings([{ results: [] }, null, "oops"])).toEqual({ holdings: [], skipped: [] });
  });
});
