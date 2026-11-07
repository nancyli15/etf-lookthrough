import { describe, expect, it } from "vitest";
import { fundView, inView, matchesSearch, pageCount, pageNumbers, pageOf, sortForView, viewFund } from "./paging";

const rows = Array.from({ length: 502 }, (_, index) => index + 1);

describe("paging", () => {
  it("splits 502 companies into 51 pages of 10", () => {
    expect(pageCount(502)).toBe(51);
    expect(pageCount(0)).toBe(1);
    expect(pageOf(rows, 2)).toMatchObject({ page: 2, first: 11, last: 20, rows: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] });
    expect(pageOf(rows, 51)).toMatchObject({ first: 501, last: 502 });
  });

  it("shows the last page instead of an empty one when a search shrinks the list", () => {
    expect(pageOf([1, 2, 3], 9)).toMatchObject({ page: 1, first: 1, last: 3 });
    expect(pageOf([], 1)).toMatchObject({ page: 1, first: 0, last: 0, rows: [] });
  });

  it("numbers the pages with gaps: 1 … 4 5 6 … 51", () => {
    expect(pageNumbers(5, 51)).toEqual([1, "…", 4, 5, 6, "…", 51]);
    expect(pageNumbers(1, 51)).toEqual([1, 2, 3, 4, "…", 51]);
    expect(pageNumbers(51, 51)).toEqual([1, "…", 48, 49, 50, 51]);
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  // Made-up companies: how much of each you bought, and how much comes through each fund.
  const company = (name: string, direct: number, byFund: [string, number][]) => {
    const throughFunds = byFund.reduce((sum, [, value]) => sum + value, 0);
    return { name, direct, throughFunds, total: direct + throughFunds, byFund: byFund.map(([symbol, value]) => ({ symbol, value })) };
  };
  const both = company("both", 100, [["SPY", 10]]);
  const fundOnly = company("fundOnly", 0, [["SPY", 5], ["XQQ", 40]]);
  const directOnly = company("directOnly", 100, []);
  const all = [both, fundOnly, directOnly];

  it("filters to what you bought, or what's in your funds", () => {
    expect(all.filter((c) => inView("direct", c))).toEqual([both, directOnly]);
    expect(all.filter((c) => inView("funds", c))).toEqual([both, fundOnly]);
    expect(all.filter((c) => inView("all", c))).toHaveLength(3);
  });

  it("filters to one fund's companies, largest through that fund first", () => {
    const inSpy = all.filter((c) => inView(fundView("SPY"), c));
    expect(inSpy).toEqual([both, fundOnly]);
    // In SPY, "both" has $10 and "fundOnly" $5, so "both" first.
    expect(sortForView(fundView("SPY"), inSpy).map((c) => c.name)).toEqual(["both", "fundOnly"]);
    expect(all.filter((c) => inView(fundView("XQQ"), c))).toEqual([fundOnly]);
    expect(viewFund(fundView("XEQT"))).toBe("XEQT");
    expect(viewFund("all")).toBeUndefined();
  });

  it("keeps the usual order outside a fund's view", () => {
    expect(sortForView("all", all)).toBe(all);
  });

  it("searches the ticker and the name, ignoring case", () => {
    expect(matchesSearch("tes", "TSLA", "Tesla")).toBe(true);
    expect(matchesSearch("tsla", "TSLA", "Tesla")).toBe(true);
    expect(matchesSearch("apple", "TSLA", "Tesla")).toBe(false);
    expect(matchesSearch("  ", "TSLA")).toBe(true);
  });
});
