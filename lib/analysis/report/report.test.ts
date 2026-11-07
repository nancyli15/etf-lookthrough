import { describe, expect, it } from "vitest";
import type { CompanyExposure } from "../lookthrough/lookthrough";
import { displayName, shortName } from "../../display/names/names";
import { buildReport, headlineFor } from "./report";

function company(name: string, direct: number, viaFunds: string[], percent: number, throughFunds = 0): CompanyExposure {
  return { key: name, symbol: name, name, direct, throughFunds, total: direct + throughFunds, percent, viaFunds, byFund: [], directUnits: 0 };
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
    const companies = [company("Tesla", 0, ["SPY"], 0.09), company("Apple", 100, ["SPY", "FXAIX"], 0.08)];
    expect(headlineFor(companies)?.title).toBe("Tesla is your biggest company, at 9.0% of your holdings.");
    expect(headlineFor(companies)?.detail).toBe("You own it only through SPY, so it doesn't appear on your brokerage's list.");
  });

  it("names the funds when a company is held both ways, and how much more you own than your shares", () => {
    // $5,731 bought directly and $2,866 through funds: 50% more than the shares alone.
    expect(headlineFor([company("Microsoft", 5731, ["SPY", "FXAIX"], 0.5, 2866)])?.detail).toBe(
      "You own it directly and through SPY and FXAIX, so you own 50% more of it than your shares alone.",
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
    ["NVIDIA Corporation", "NVIDIA"],
    ["NVIDIA CORP", "NVIDIA"],
    ["JPMORGAN CHASE + CO", "JPMorgan Chase"],
    ["EXXONMOBIL HOLDINGS CORP", "ExxonMobil"],
    ["MASTERCARD INC   A", "Mastercard"],
    ["PALANTIR TECHNOLOGIES INC A", "Palantir Technologies"],
    ["PROCTER + GAMBLE CO/THE", "Procter & Gamble"],
    ["Alphabet Inc. Class A Common Stock", "Alphabet"],
    ["ROYAL BANK OF CANADA", "Royal Bank of Canada"],
    ["ROLLS-ROYCE HOLDINGS PLC", "Rolls-Royce"],
    ["ASTRAZENECA PLC", "AstraZeneca"],
    ["ISHARES S&P/TSX CAPPED COMPOSITE", "iShares S&P/TSX Capped Composite"],
    ["INDUSTRIAL AND COMMERCIAL BANK OF", "Industrial and Commercial Bank of China"],
  ])("%s becomes %s", (name, expected) => {
    expect(shortName(name)).toBe(expected);
  });
});

describe("net worth", () => {
  // The real Sandbox numbers that exposed the bug. SnapTrade's account totals leave
  // SPAXX's $3,500 out of positions, because it's already inside the IRA's cash.
  const position = (symbol: string, kind: string, units: string, price: string, cashEquivalent?: boolean) => ({
    instrument: { kind, symbol, description: symbol, currency: "USD" },
    units,
    price,
    currency: "USD",
    ...(cashEquivalent === undefined ? {} : { cash_equivalent: cashEquivalent }),
  });
  const account = (name: string, total: number, cash: number, results: unknown[]) => ({
    account: { name, balance: { total: { amount: total, currency: "USD" } } },
    positions: positions(results),
    balances: { ok: true, data: [{ currency: { code: "USD" }, cash }] },
  });
  const sandbox = [
    account("Individual", 68851.25, 25000, [
      position("AAPL", "stock", "5", "180.5"),
      position("MSFT", "stock", "10", "410"),
      position("TSLA", "stock", "8", "240"),
      position("SPY", "etf", "15", "558.25"),
      position("BTC", "crypto", "0.25", "59000"),
      position("ETH", "crypto", "2.5", "2650"),
      position("SOL", "crypto", "40", "142"),
      position("USDC", "crypto", "1500", "1"),
    ]),
    account("IRA", 36774.60064, 12500, [
      position("NVDA", "stock", "12", "120"),
      position("GOOGL", "stock", "3", "170"),
      position("FXAIX", "mutualfund", "120.5432", "185.2", false),
      position("SPAXX", "mutualfund", "3500", "1", true),
    ]),
  ];

  it("doesn't count a money market fund twice, and matches SnapTrade's total", () => {
    const report = buildReport(sandbox);
    expect(report.netWorth).toBeCloseTo(105625.85, 2);
    expect(report.brokerageTotal).toBeCloseTo(105625.85, 2);
    expect(report.differsFromBrokerage).toBe(false);
    expect(report.cash).toBe(37500);
    expect(report.result.cashEquivalents).toMatchObject([{ symbol: "SPAXX", value: 3500 }]);
    expect(report.result.notLookedThrough.map((holding) => holding.symbol)).toEqual(["BTC", "ETH", "SOL", "USDC"]);
    expect(report.result.total).toBeCloseTo(68125.85, 2);
  });

  it("flags a total that disagrees with SnapTrade by more than 1%", () => {
    const report = buildReport([account("IRA", 1000, 0, [position("AAPL", "stock", "1", "1100")])]);
    expect(report.differsFromBrokerage).toBe(true);
  });

  it("allows small differences, since prices can move between calls", () => {
    const report = buildReport([account("IRA", 1000, 0, [position("AAPL", "stock", "1", "1005")])]);
    expect(report.differsFromBrokerage).toBe(false);
  });

  it("skips the check unless every account reports a total", () => {
    const report = buildReport([
      account("IRA", 1000, 0, [position("AAPL", "stock", "1", "1000")]),
      { positions: positions([position("TSLA", "stock", "1", "5000")]) },
    ]);
    expect(report.brokerageTotal).toBeUndefined();
    expect(report.differsFromBrokerage).toBe(false);
  });

  it("doesn't add a second warning when data is already missing", () => {
    const report = buildReport([
      { ...account("IRA", 5000, 0, [position("AAPL", "stock", "1", "1000")]), balances: { ok: false, data: null } },
    ]);
    expect(report.cashNotLoaded).toEqual(["IRA"]);
    expect(report.differsFromBrokerage).toBe(false);
  });
});

describe("displayName", () => {
  it("softens all-caps fund file names and leaves mixed case alone", () => {
    expect(displayName("APPLE INC")).toBe("Apple Inc");
    expect(displayName("Alphabet")).toBe("Alphabet");
  });

  it("fixes SPDR's + for & and capitalizes after an ampersand", () => {
    expect(displayName("ELI LILLY + CO")).toBe("Eli Lilly & Co");
    expect(displayName("ISHARES CORE S&P")).toBe("iShares Core S&P");
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
    // Canadian cash makes the report CAD: 100 USD is 139.78 CAD, plus 139.78 CAD.
    expect(r.result.currency).toBe("CAD");
    expect(r.cash).toBeCloseTo(279.56);
    expect(r.result.fxAsOf).toBeDefined();
  });

  it("reports an account with only CAD cash in CAD, with no conversion, like an empty FHSA", () => {
    const r = buildReport([{ positions: positions([]), balances: { ok: true, data: [{ currency: { code: "CAD" }, cash: 18.59 }] } }]);
    expect(r.result.currency).toBe("CAD");
    expect(r.cash).toBeCloseTo(18.59);
    expect(r.result.fxAsOf).toBeUndefined();
  });

  it("reports in the currency the switch chose: 100 USD is 139.78 CAD", () => {
    const r = buildReport([{ positions: positions([aapl]), balances: { ok: true, data: [{ currency: { code: "USD" }, cash: 100 }] } }], {
      currency: "CAD",
    });
    expect(r.result.currency).toBe("CAD");
    expect(r.cash).toBeCloseTo(139.78);
    expect(r.result.total).toBeCloseTo(500 * 1.3978);
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

describe("how far back activity goes", () => {
  const since = (date?: string) => ({
    account: { name: "A", sync_status: { transactions: { first_transaction_date: date } } },
    positions: positions([aapl]),
  });

  it("uses the latest start across accounts, since every account covers it", () => {
    expect(buildReport([since("2026-09-16"), since("2025-01-03")]).activitySince).toBe("2026-09-16");
  });

  it("gives no date if any account doesn't say", () => {
    expect(buildReport([since("2026-09-16"), since(undefined)]).activitySince).toBeUndefined();
  });

  it("lists accounts whose activity didn't load", () => {
    const failed = { ...since("2026-09-16"), activities: { ok: false, data: {} } };
    expect(buildReport([failed]).activityNotLoaded).toEqual(["A"]);
  });
});
