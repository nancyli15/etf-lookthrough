import { describe, expect, it } from "vitest";
import { formatMoney, percentText, syncedText } from "./format";

describe("syncedText", () => {
  const now = new Date("2026-11-07T15:00:00Z");

  it("says how long ago, in the biggest whole unit", () => {
    expect(syncedText("2026-11-07T14:59:30Z", now)).toBe("Holdings synced just now");
    expect(syncedText("2026-11-07T14:59:00Z", now)).toBe("Holdings synced 1 minute ago");
    expect(syncedText("2026-11-07T14:20:00Z", now)).toBe("Holdings synced 40 minutes ago");
    expect(syncedText("2026-11-07T12:00:00Z", now)).toBe("Holdings synced 3 hours ago");
    expect(syncedText("2026-11-05T15:00:00Z", now)).toBe("Holdings synced 2 days ago");
  });

  it("gives the date, not a made-up time, when there's no time or it's in the future", () => {
    expect(syncedText("2026-11-04", now)).toMatch(/^Holdings as of /);
    expect(syncedText("2026-11-07T16:00:00Z", now)).toMatch(/^Holdings as of /);
  });
});

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
