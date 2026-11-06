import { describe, expect, it } from "vitest";
import { inView, matchesSearch, pageCount, pageNumbers, pageOf } from "./paging";

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

  it("filters to what you bought, or what's in your funds", () => {
    const both = { direct: 100, throughFunds: 10 };
    const fundOnly = { direct: 0, throughFunds: 10 };
    const directOnly = { direct: 100, throughFunds: 0 };
    expect([both, fundOnly, directOnly].filter((company) => inView("direct", company))).toEqual([both, directOnly]);
    expect([both, fundOnly, directOnly].filter((company) => inView("funds", company))).toEqual([both, fundOnly]);
    expect([both, fundOnly, directOnly].filter((company) => inView("all", company))).toHaveLength(3);
  });

  it("searches the ticker and the name, ignoring case", () => {
    expect(matchesSearch("tes", "TSLA", "Tesla")).toBe(true);
    expect(matchesSearch("tsla", "TSLA", "Tesla")).toBe(true);
    expect(matchesSearch("apple", "TSLA", "Tesla")).toBe(false);
    expect(matchesSearch("  ", "TSLA")).toBe(true);
  });
});
