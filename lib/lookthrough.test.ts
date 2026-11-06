import { describe, expect, it } from "vitest";
import type { Fund, FundHolding } from "../data/fund-types";
import { FUNDS } from "../data/funds";
import type { Holding } from "./holdings";
import { lookThrough } from "./lookthrough";

function holding(symbol: string, kind: string, value: number, extra: Partial<Holding> = {}): Holding {
  return { symbol, name: symbol, kind, units: 1, price: value, currency: "USD", value, ...extra };
}

function fund(symbol: string, holdings: FundHolding[], extra: Partial<Fund> = {}): Fund {
  const listed = holdings.reduce((sum, h) => sum + h.weight, 0);
  return { symbol, name: symbol, asOf: "2026-11-02", source: "test", holdings, other: 1 - listed, ...extra };
}

const stock = (symbol: string, weight: number): FundHolding => ({ symbol, name: symbol, weight });

const spy = fund("SPY", [stock("AAPL", 0.07)]);

describe("exposure", () => {
  it("adds direct and through-fund value: $500 AAPL + 7% of $1,000 SPY = $570", () => {
    const r = lookThrough([holding("SPY", "etf", 1000), holding("AAPL", "stock", 500)], { funds: { SPY: spy } });
    expect(r.companies[0]).toMatchObject({ symbol: "AAPL", direct: 500, viaFunds: ["SPY"] });
    expect(r.companies[0].throughFunds).toBeCloseTo(70);
    expect(r.companies[0].total).toBeCloseTo(570);
    expect(r.companies[0].percent).toBeCloseTo(570 / 1500);
  });

  it("says how much comes through each fund: 7% of $1,000 SPY = $70, 5% of $2,000 QQQ = $100", () => {
    const qqq = fund("QQQ", [stock("AAPL", 0.05)]);
    const r = lookThrough([holding("SPY", "etf", 1000), holding("QQQ", "etf", 2000)], { funds: { SPY: spy, QQQ: qqq } });
    expect(r.companies[0].byFund.map((entry) => entry.symbol)).toEqual(["QQQ", "SPY"]);
    expect(r.companies[0].byFund[0].value).toBeCloseTo(100);
    expect(r.companies[0].byFund[1].value).toBeCloseTo(70);
  });

  it("follows funds that hold funds: $1,000 × 40% × 90% × 10% = $36", () => {
    const funds = {
      TOP: fund("TOP", [stock("MID", 0.4)]),
      MID: fund("MID", [stock("LOW", 0.9)]),
      LOW: fund("LOW", [stock("AAPL", 0.1)]),
    };
    const r = lookThrough([holding("TOP", "etf", 1000)], { funds });
    expect(r.companies).toHaveLength(1);
    expect(r.companies[0].total).toBeCloseTo(36);
    expect(r.companies[0].viaFunds).toEqual(["TOP"]);
  });

  it("groups share classes of one company: GOOGL + GOOG = Alphabet", () => {
    const funds = { F: fund("F", [stock("GOOGL", 0.02), stock("GOOG", 0.01)]) };
    const r = lookThrough([holding("F", "etf", 1000), holding("GOOGL", "stock", 100)], { funds });
    expect(r.companies).toHaveLength(1);
    expect(r.companies[0].name).toBe("Alphabet");
    expect(r.companies[0].total).toBeCloseTo(130);
  });

  it("keeps the same ticker on different exchanges apart: ROP is Roche or Roper", () => {
    const roche: FundHolding = { symbol: "ROP", name: "ROCHE", exchange: "SIX Swiss Exchange", weight: 0.1 };
    const r = lookThrough([holding("F", "etf", 1000), holding("ROP", "stock", 50)], {
      funds: { F: fund("F", [roche]) },
    });
    expect(r.companies).toHaveLength(2);
  });

  it("matches a US-listed stock in a fund with the same stock held directly", () => {
    const apple: FundHolding = { symbol: "AAPL", name: "APPLE", exchange: "NASDAQ", weight: 0.1 };
    const r = lookThrough([holding("F", "etf", 1000), holding("AAPL", "stock", 50, { exchange: "XNAS" })], {
      funds: { F: fund("F", [apple]) },
    });
    expect(r.companies).toHaveLength(1);
    expect(r.companies[0].total).toBeCloseTo(150);
  });

  it("treats BRK.B and BRKB as the same ticker", () => {
    const r = lookThrough([holding("F", "etf", 1000), holding("BRKB", "stock", 50)], {
      funds: { F: fund("F", [stock("BRK.B", 0.1)]) },
    });
    expect(r.companies).toHaveLength(1);
  });

  it("finds a fund whose symbol carries a Toronto suffix", () => {
    const r = lookThrough([holding("XIC.TO", "etf", 1000, { currency: "CAD" })], {
      funds: { XIC: fund("XIC", [{ symbol: "RY", name: "RBC", exchange: "Toronto Stock Exchange", weight: 0.1 }]) },
    });
    expect(r.companies[0].total).toBeCloseTo(100);
  });

  it("matches a Toronto stock held directly with the same stock in a fund", () => {
    const r = lookThrough(
      [holding("XIC", "etf", 1000, { currency: "CAD" }), holding("RY.TO", "stock", 50, { currency: "CAD" })],
      { funds: { XIC: fund("XIC", [{ symbol: "RY", name: "RBC", exchange: "Toronto Stock Exchange", weight: 0.1 }]) } },
    );
    expect(r.companies).toHaveLength(1);
    expect(r.companies[0].total).toBeCloseTo(150);
  });
});

describe("portfolio sections", () => {
  it("lists direct stocks with shares, and every holding lands in exactly one section", () => {
    const r = lookThrough(
      [
        holding("AAPL", "stock", 500),
        holding("SPY", "etf", 1000),
        holding("BTC", "crypto", 100, { notLookedThrough: "crypto" }),
      ],
      { funds: { SPY: spy } },
    );
    expect(r.directHoldings).toMatchObject([{ symbol: "AAPL", value: 500 }]);
    const sections =
      r.directHoldings.reduce((sum, direct) => sum + direct.value, 0) +
      r.funds.reduce((sum, fund) => sum + fund.value, 0) +
      r.notLookedThrough.reduce((sum, item) => sum + item.value, 0);
    expect(sections).toBeCloseTo(r.total);
  });
});

describe("what can't be looked through", () => {
  it("lists crypto and unknown funds with reasons, and counts them in the total", () => {
    const r = lookThrough(
      [
        holding("BTC", "crypto", 100, { notLookedThrough: "crypto: no companies to look through" }),
        holding("SPAXX", "mutualfund", 200),
      ],
      { funds: {} },
    );
    expect(r.total).toBe(300);
    expect(r.companies).toEqual([]);
    expect(r.notLookedThrough.map((n) => n.symbol)).toEqual(["BTC", "SPAXX"]);
    expect(r.notLookedThrough[1].reason).toContain("contents");
  });

  it("reports a nested fund with no file separately, not as a company", () => {
    const funds = { F: fund("F", [stock("ITOT", 0.5), stock("AAPL", 0.1)]) };
    const r = lookThrough([holding("F", "etf", 1000)], { funds, fundsWithoutData: new Set(["ITOT"]) });
    expect(r.companies.map((c) => c.symbol)).toEqual(["AAPL"]);
    expect(r.insideUnopenedFunds).toEqual([{ symbol: "ITOT", name: "ITOT", value: 500 }]);
  });

  it("doesn't crash on a loop of funds holding each other", () => {
    const funds = { A: fund("A", [stock("B", 0.5)]), B: fund("B", [stock("A", 0.5)]) };
    expect(lookThrough([holding("A", "etf", 1000)], { funds }).insideUnopenedFunds[0].symbol).toBe("A");
  });

  it("accounts for every dollar", () => {
    const funds = { F: fund("F", [stock("ITOT", 0.3), stock("AAPL", 0.2)]) };
    const r = lookThrough(
      [
        holding("F", "etf", 1000),
        holding("MSFT", "stock", 250),
        holding("BTC", "crypto", 100, { notLookedThrough: "crypto" }),
        holding("XYZ", "etf", 50),
      ],
      { funds, fundsWithoutData: new Set(["ITOT"]) },
    );
    const companies = r.companies.reduce((sum, c) => sum + c.total, 0);
    const unopened = r.insideUnopenedFunds.reduce((sum, u) => sum + u.value, 0);
    const excluded = r.notLookedThrough.reduce((sum, n) => sum + n.value, 0);
    expect(companies + unopened + excluded + r.otherInFunds).toBeCloseTo(r.total);
    expect(r.otherInFunds).toBeCloseTo(500);
  });

  it("returns zeros, not NaN, for an empty portfolio", () => {
    expect(lookThrough([])).toMatchObject({ total: 0, companies: [], overlaps: [], otherInFunds: 0 });
  });
});

describe("currency", () => {
  it("doesn't convert when everything is in one currency", () => {
    const r = lookThrough([holding("RY", "stock", 100, { currency: "CAD" })], { funds: {} });
    expect(r).toMatchObject({ currency: "CAD", total: 100 });
    expect(r.fxAsOf).toBeUndefined();
  });

  it("converts mixed holdings to CAD at the dated rate: 100 USD at 1.4 = 140 CAD", () => {
    const fx = { cadPerUsd: 1.4, asOf: "2026-11-02", source: "test" };
    const r = lookThrough(
      [holding("AAPL", "stock", 100), holding("RY", "stock", 60, { currency: "CAD" })],
      { funds: {}, fx },
    );
    expect(r.currency).toBe("CAD");
    expect(r.total).toBeCloseTo(200);
    expect(r.fxAsOf).toBe("2026-11-02");
  });

  it("leaves out a currency with no rate, and says why", () => {
    const r = lookThrough(
      [holding("AAPL", "stock", 100), holding("SAP", "stock", 50, { currency: "EUR" })],
      { funds: {} },
    );
    expect(r.total).toBe(100);
    expect(r.notLookedThrough).toEqual([]);
    expect(r.unconverted).toEqual([{ symbol: "SAP", name: "SAP", value: 50, currency: "EUR" }]);
  });
});

describe("fund overlap", () => {
  const funds = {
    A: fund("A", [stock("AAPL", 0.1), stock("MSFT", 0.05)]),
    B: fund("B", [stock("AAPL", 0.04), stock("MSFT", 0.08), stock("TSLA", 0.02)]),
  };

  it("adds the smaller weight of each shared company: min(10,4) + min(5,8) = 9%", () => {
    const r = lookThrough([holding("A", "etf", 100), holding("B", "etf", 100)], { funds });
    expect(r.overlaps).toHaveLength(1);
    expect(r.overlaps[0].sharedWeight).toBeCloseTo(0.09);
    expect(r.overlaps[0].sharedCompanies).toEqual(["MSFT", "AAPL"]);
    expect(r.overlaps[0].basis).toBe("top-holdings");
  });

  it("calls two funds on the same list a 100% overlap", () => {
    const list = { SPY: spy, FXAIX: { ...spy, symbol: "FXAIX", approximatedBy: "SPY" } };
    const r = lookThrough([holding("SPY", "etf", 100), holding("FXAIX", "mutualfund", 100)], { funds: list });
    expect(r.overlaps[0]).toMatchObject({ sharedWeight: 1, basis: "same-list" });
  });

  it("warns when a fund has too much inside funds we can't open", () => {
    const withGap = { ...funds, C: fund("C", [stock("ITOT", 0.45), stock("AAPL", 0.01)]) };
    const r = lookThrough([holding("A", "etf", 100), holding("C", "etf", 100)], {
      funds: withGap,
      fundsWithoutData: new Set(["ITOT"]),
    });
    expect(r.overlaps[0].incomplete).toBe(true);
  });

  it("merges one fund held in two currencies, so it never overlaps itself", () => {
    const r = lookThrough([holding("A", "etf", 100), holding("A", "etf", 100, { currency: "CAD" })], { funds });
    expect(r.funds).toHaveLength(1);
    expect(r.overlaps).toEqual([]);
  });
});

describe("with the real fund snapshot", () => {
  // BlackRock's own table puts Royal Bank at 2.01% of XEQT on 2026-11-02.
  it("matches BlackRock's published Royal Bank weight on $1,000 of XEQT", () => {
    const r = lookThrough([holding("XEQT", "etf", 1000, { currency: "CAD" })]);
    expect(r.companies.find((c) => c.symbol === "RY")!.total).toBeCloseTo(20.1, 1);
  });

  it("gives $76 of Apple on $1,000 of SPY at 7.6%, plus $500 direct", () => {
    const r = lookThrough([holding("SPY", "etf", 1000), holding("AAPL", "stock", 500, { exchange: "NASDAQ" })]);
    const apple = r.companies.find((c) => c.symbol === "AAPL")!;
    expect(apple.total).toBeCloseTo(575.96, 1);
  });

  it("doesn't count a fund as a company anywhere in the snapshot", () => {
    for (const f of Object.values(FUNDS)) {
      const r = lookThrough([holding(f.symbol, "etf", 1000)]);
      const named = r.companies.filter((c) => /ishares|\betf\b/i.test(c.name));
      expect(named, f.symbol).toEqual([]);
    }
  });
});
