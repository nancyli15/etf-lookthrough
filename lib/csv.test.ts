import { describe, expect, it } from "vitest";
import { companiesCsv, fundsCsv, overlapsCsv } from "./csv";
import { buildReport } from "./report";

function position(symbol: string, kind: string, price: string, description: string) {
  return { instrument: { kind, symbol, description, currency: "USD" }, units: "1", price, currency: "USD" };
}

const { result } = buildReport([
  {
    account: { name: "My secret IRA" },
    positions: {
      ok: true,
      status: 200,
      data: {
        results: [
          position("AAPL", "stock", "500", "Apple Inc"),
          position("SPY", "etf", "1000", "SPDR S&P 500"),
          position("FXAIX", "mutualfund", "800", "Fidelity 500"),
        ],
      },
    },
    balances: { ok: true, data: [{ cash: "999", currency: "USD" }] },
  },
]);

describe("CSV downloads", () => {
  it("lists every company, with a column per fund that adds up to 'Through funds'", () => {
    const lines = companiesCsv(result).trim().split("\n");
    expect(lines[0]).toBe(
      "Company,Ticker,Total (USD),Bought directly (USD),Through funds (USD),% of holdings,SPY (USD),FXAIX (USD)",
    );
    expect(lines).toHaveLength(result.companies.length + 1);
    const apple = lines.find((line) => line.includes(",AAPL,"))!.split(",");
    expect(Number(apple[3])).toBe(500);
    expect(Number(apple[6]) + Number(apple[7])).toBeCloseTo(Number(apple[4]), 1);
  });

  it("lists each fund and each overlapping pair", () => {
    expect(fundsCsv(result)).toMatch(/\nSPY,[^,]*,1000,/); // Any name: the sample data names SPY differently.
    expect(fundsCsv(result)).toContain(",SPY\n"); // FXAIX uses SPY's holdings.
    expect(overlapsCsv(result)).toContain("Same index");
  });

  it("quotes names with commas so the columns don't shift", () => {
    const tricky = { ...result, companies: [{ ...result.companies[0], name: 'Apple, Inc. "AAPL"' }] };
    expect(companiesCsv(tricky)).toContain('"Apple, Inc. ""AAPL"""');
  });

  it("never includes cash or account names", () => {
    for (const csv of [companiesCsv(result), fundsCsv(result), overlapsCsv(result)]) {
      expect(csv).not.toMatch(/999|IRA/);
    }
  });
});
