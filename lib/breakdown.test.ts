import { describe, expect, it } from "vitest";
import type { Fund, FundHolding } from "../data/fund-types";
import { holdingsBreakdown, netWorthBreakdown } from "./breakdown";
import type { Holding } from "./holdings";
import { lookThrough } from "./lookthrough";

const holding = (symbol: string, kind: string, value: number, extra: Partial<Holding> = {}): Holding => ({
  symbol,
  name: symbol,
  kind,
  units: 1,
  price: value,
  currency: "USD",
  value,
  ...extra,
});
const stock = (symbol: string, weight: number): FundHolding => ({ symbol, name: symbol, weight });
const fund = (symbol: string, holdings: FundHolding[]): Fund => ({
  symbol,
  name: symbol,
  asOf: "2026-11-04",
  source: "test",
  holdings,
  other: 1 - holdings.reduce((total, h) => total + h.weight, 0),
});

describe("where your holdings go", () => {
  // $500 of AAPL you bought, $1,000 of a fund that's 90% AAPL + 5% HIDDEN (a fund we
  // can't open) + 5% cash, and $100 of crypto.
  const result = lookThrough(
    [holding("AAPL", "stock", 500), holding("F", "etf", 1000), holding("BTC", "crypto", 100, { notLookedThrough: "Crypto" })],
    { funds: { F: fund("F", [stock("AAPL", 0.9), stock("HIDDEN", 0.05)]) }, fundsWithoutData: new Set(["HIDDEN"]) },
  );
  const slices = holdingsBreakdown(result);
  const value = (key: string) => slices.find((slice) => slice.key === key)?.value;

  it("splits holdings into what you bought, companies in funds, the rest of funds, and crypto", () => {
    expect(value("direct")).toBeCloseTo(500);
    expect(value("funds")).toBeCloseTo(900);
    expect(value("fundOther")).toBeCloseTo(100); // $50 cash + $50 in HIDDEN.
    expect(value("notLooked")).toBeCloseTo(100);
  });

  it("adds up to exactly the holdings in the summary", () => {
    expect(slices.reduce((total, slice) => total + slice.value, 0)).toBeCloseTo(result.total, 6);
  });

  it("leaves out empty parts", () => {
    const onlyStocks = holdingsBreakdown(lookThrough([holding("AAPL", "stock", 500)], { funds: {} }));
    expect(onlyStocks.map((slice) => slice.key)).toEqual(["direct"]);
  });

  it("adds the cash in your accounts for net worth, and still adds up", () => {
    const withCash = netWorthBreakdown(result, 250);
    expect(withCash.at(-1)).toEqual({ key: "cash", label: "Cash in your accounts", value: 250 });
    expect(withCash.reduce((total, slice) => total + slice.value, 0)).toBeCloseTo(result.total + 250, 6);
    expect(netWorthBreakdown(result, 0).some((slice) => slice.key === "cash")).toBe(false);
  });
});
