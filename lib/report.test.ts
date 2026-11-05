import { describe, expect, it } from "vitest";
import type { CompanyExposure } from "./lookthrough";
import { buildReport, displayName, headlineFor } from "./report";

function company(name: string, direct: number, viaFunds: string[], percent: number): CompanyExposure {
  return { key: name, symbol: name, name, direct, throughFunds: 0, total: 0, percent, viaFunds };
}

function positions(results: unknown[], asOf?: string) {
  return { ok: true, status: 200, data: { results, data_freshness: { as_of: asOf } } };
}

const aapl = {
  instrument: { kind: "stock", symbol: "AAPL", description: "Apple Inc", currency: "USD" },
  units: "1",
  price: "500",
  currency: "USD",
};
const spy = {
  instrument: { kind: "etf", symbol: "SPY", description: "SPDR S&P 500", currency: "USD" },
  units: "1",
  price: "1000",
  currency: "USD",
};

describe("headlineFor", () => {
  it("leads with the largest company owned both directly and through funds", () => {
    const companies = [company("Nvidia", 0, ["SPY"], 0.09), company("Apple", 100, ["SPY", "FXAIX"], 0.08)];
    expect(headlineFor(companies)).toBe("You own Apple directly and through 2 funds: 8.0% of your portfolio.");
  });

  it("says fund, not funds, for one", () => {
    expect(headlineFor([company("Apple", 100, ["SPY"], 0.5)])).toContain("through 1 fund:");
  });

  it("falls back to the largest company when nothing is held both ways", () => {
    expect(headlineFor([company("Apple", 0, ["SPY"], 0.1)])).toBe("You own Apple through 1 fund: 10.0% of your portfolio.");
    expect(headlineFor([company("Apple", 100, [], 1)])).toBe("You own Apple directly: 100.0% of your portfolio.");
  });

  it("has no headline when there are no companies", () => {
    expect(headlineFor([])).toBeUndefined();
  });
});

describe("displayName", () => {
  it("softens all-caps fund file names and leaves mixed case alone", () => {
    expect(displayName("APPLE INC")).toBe("Apple Inc");
    expect(displayName("Alphabet")).toBe("Alphabet");
  });

  it("fixes SPDR's + for & and capitalizes after an ampersand", () => {
    expect(displayName("ELI LILLY + CO")).toBe("Eli Lilly & Co");
    expect(displayName("ISHARES CORE S&P")).toBe("Ishares Core S&P");
  });
});

describe("buildReport", () => {
  it("combines accounts into one look-through", () => {
    const r = buildReport([{ positions: positions([aapl]) }, { positions: positions([spy]) }]);
    expect(r.result.total).toBe(1500);
    expect(r.headline).toContain("directly and through 1 fund");
  });

  it("names an account that failed to load, and still shows the others", () => {
    const r = buildReport([
      { account: { name: "IRA" }, positions: { ok: false, status: 500, data: "oops" } },
      { positions: positions([aapl]) },
    ]);
    expect(r.failedAccounts).toEqual(["IRA"]);
    expect(r.result.total).toBe(500);
  });

  it("passes along positions that couldn't be valued", () => {
    const r = buildReport([{ positions: positions([{ ...aapl, price: "" }]) }]);
    expect(r.skipped).toEqual(["AAPL"]);
  });

  it("uses the oldest holdings date across accounts", () => {
    const r = buildReport([
      { positions: positions([aapl], "2026-11-03T12:00:00Z") },
      { positions: positions([spy], "2026-11-01T12:00:00Z") },
    ]);
    expect(r.holdingsAsOf).toBe("2026-11-01T12:00:00Z");
  });

  it("handles no accounts without crashing", () => {
    expect(buildReport([])).toMatchObject({ headline: undefined, failedAccounts: [], skipped: [] });
  });
});
