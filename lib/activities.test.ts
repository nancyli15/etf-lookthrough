import { describe, expect, it } from "vitest";
import { recentActivity } from "./activities";

// Shaped like the Sandbox's /activities response.
function row(type: string, symbol: string | null, date: string, units = 0, price = 0, amount = 0) {
  return {
    type,
    symbol: symbol ? { symbol, raw_symbol: symbol } : null,
    trade_date: `${date}T15:53:51.926613Z`,
    units,
    price,
    amount,
    currency: { code: "USD" },
  };
}

describe("recent activity", () => {
  it("keeps trades and dividends per company, newest first", () => {
    const result = recentActivity([
      {
        data: [
          row("BUY", "AAPL", "2026-10-13", 10, 180.5, -1805),
          row("DIVIDEND", "AAPL", "2026-10-05", 0, 0, 12.5),
          row("SELL", "TSLA", "2026-10-10", -5, 240, 1200),
        ],
      },
    ]);
    expect(result.AAPL.map((activity) => activity.kind)).toEqual(["buy", "dividend"]);
    // Sells arrive as negative units, buys as negative amounts. Both read as positive.
    expect(result.TSLA[0]).toEqual({ date: "2026-10-10", kind: "sell", units: 5, price: 240, amount: 1200, currency: "USD" });
    expect(result.AAPL[0].amount).toBe(1805);
  });

  it("keeps stock dividends, like the Sandbox's Microsoft one", () => {
    const result = recentActivity([{ data: [row("STOCK_DIVIDEND", "MSFT", "2026-10-02", 0.5)] }]);
    expect(result.MSFT[0].kind).toBe("stockDividend");
  });

  it("leaves out fees, taxes and activity with no company", () => {
    const result = recentActivity([
      { data: [row("FEE", null, "2026-10-11", 0, 0, -4.95), row("TAX", "AAPL", "2026-10-04", 0, 0, -1.88)] },
    ]);
    expect(result).toEqual({});
  });

  it("keeps only the 3 most recent per company, across accounts", () => {
    const result = recentActivity([
      { data: [row("BUY", "MSFT", "2026-01-01"), row("BUY", "MSFT", "2026-03-01")] },
      [row("BUY", "MSFT", "2026-02-01"), row("SELL", "MSFT", "2026-04-01")],
    ]);
    expect(result.MSFT.map((activity) => activity.date)).toEqual(["2026-04-01", "2026-03-01", "2026-02-01"]);
  });

  it("skips rows it can't read instead of guessing", () => {
    expect(recentActivity([{ data: [{ type: "BUY" }, null, "x"] }, null, { error: "no" }])).toEqual({});
  });
});
