import { describe, expect, it } from "vitest";
import { formatMoney, percentText } from "./format";

describe("formatMoney", () => {
  it("always says which dollar it is, on any computer", () => {
    expect(formatMoney(68851.25, "USD")).toBe("US$68,851.25");
    expect(formatMoney(6535.95, "CAD")).toBe("CA$6,535.95");
  });

  it("shows a minus sign before the currency", () => {
    expect(formatMoney(-4.95, "USD")).toBe("-US$4.95");
  });

  it("shortens big numbers for the chart's axis", () => {
    expect(formatMoney(117994.93, "CAD", { compact: true })).toBe("CA$118K");
    expect(formatMoney(4100.4, "CAD", { whole: true })).toBe("CA$4,100");
  });

  it("writes the code after the amount for other currencies", () => {
    expect(formatMoney(10, "EUR")).toBe("10.00 EUR");
  });
});

describe("percentText", () => {
  it("never shows a real amount as 0.0%", () => {
    expect(percentText(69.46 / 200000)).toBe("<0.1%");
    expect(percentText(0)).toBe("0.0%");
    expect(percentText(0.473)).toBe("47.3%");
  });
});
