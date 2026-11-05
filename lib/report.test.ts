import { describe, expect, it } from "vitest";
import type { CompanyExposure } from "./lookthrough";
import { buildReport, displayName, headlineFor, shortName } from "./report";

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
  it("names the largest company overall, even when it's held only through funds", () => {
    const companies = [company("Nvidia", 0, ["SPY"], 0.09), company("Apple", 100, ["SPY", "FXAIX"], 0.08)];
    expect(headlineFor(companies)?.title).toBe("Nvidia is your biggest company, at 9.0% of your holdings.");
    expect(headlineFor(companies)?.detail).toBe("You own it only through SPY, so it doesn't appear on your brokerage's list.");
  });

  it("names the funds when a company is held both ways", () => {
    expect(headlineFor([company("Apple", 100, ["SPY", "FXAIX"], 0.5)])?.detail).toContain(
      "directly and through SPY and FXAIX",
    );
  });

  it("doesn't claim a hidden holding for a company held only directly", () => {
    expect(headlineFor([company("Apple", 100, [], 1)])?.detail).toBe(
      "You own it directly, and none of the funds we can see hold it.",
    );
  });

  it("has no headline when there are no companies", () => {
    expect(headlineFor([])).toBeUndefined();
  });
});

describe("shortName", () => {
  it.each([
    ["Microsoft Corporation Common Stock", "Microsoft"],
    ["Apple Inc.", "Apple"],
    ["Tesla, Inc.", "Tesla"],
    ["Meta Platforms Inc Class A", "Meta Platforms"],
    ["Visa Inc Class A Shares", "Visa"],
    ["BERKSHIRE HATHAWAY INC CL B", "Berkshire Hathaway"],
    ["ELI LILLY + CO", "Eli Lilly"],
    ["Alphabet", "Alphabet"],
    ["Coca-Cola Co", "Coca-Cola"],
    ["Inc", "Inc"],
  ])("%s becomes %s", (name, expected) => {
    expect(shortName(name)).toBe(expected);
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
    expect(r.headline?.detail).toContain("directly and through SPY");
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

  it("adds cash across accounts, converting to the report's currency", () => {
    const r = buildReport([
      { positions: positions([aapl]), balances: { ok: true, data: [{ currency: { code: "USD" }, cash: 100 }] } },
      { positions: positions([]), balances: { ok: true, data: [{ currency: { code: "CAD" }, cash: 139.78 }] } },
    ]);
    expect(r.cash).toBeCloseTo(200); // 139.78 CAD is 100 USD at 1.3978.
    expect(r.result.fxAsOf).toBeDefined();
  });

  it("lists cash it can't count instead of treating it as zero", () => {
    const r = buildReport([
      { account: { name: "IRA" }, positions: positions([aapl]), balances: { ok: false, data: null } },
      { positions: positions([]), balances: { ok: true, data: [{ currency: { code: "EUR" }, cash: 50 }, { currency: { code: "USD" }, cash: null }] } },
    ]);
    expect(r.cash).toBe(0);
    expect(r.cashNotLoaded).toEqual(["IRA"]);
    expect(r.cashUnconverted).toEqual(["EUR"]);
  });

  it("handles no accounts without crashing", () => {
    expect(buildReport([])).toMatchObject({ headline: undefined, failedAccounts: [], skipped: [] });
  });
});
