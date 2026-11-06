import { describe, expect, it } from "vitest";
import { combineHistory, splitAtGaps, type HistoryResponse } from "./history";

function account(name: string, rows: [string, string][], currency = "USD"): HistoryResponse {
  return {
    name,
    status: 200,
    ok: true,
    data: { history: rows.map(([date, total_value]) => ({ date, total_value })), currency },
  };
}

describe("account value history", () => {
  it("adds accounts together on each date: $100 + $50 = $150", () => {
    const history = combineHistory(
      [account("A", [["2026-11-02", "100"], ["2026-11-03", "110"]]), account("B", [["2026-11-02", "50"], ["2026-11-03", "40"]])],
      "USD",
    );
    expect(history.points).toEqual([
      { date: "2026-11-02", value: 150 },
      { date: "2026-11-03", value: 150 },
    ]);
    expect(history.included).toEqual(["A", "B"]);
  });

  it("accepts full timestamps, as in SnapTrade's own example", () => {
    const history = combineHistory([account("A", [["2026-01-01T00:00:00.000Z", "15363.23"]])], "USD");
    expect(history.points).toEqual([{ date: "2026-01-01", value: 15363.23 }]);
  });

  it("drops dates only some accounts report, instead of showing a fake drop", () => {
    const history = combineHistory(
      [account("A", [["2026-11-02", "100"], ["2026-11-03", "110"]]), account("B", [["2026-11-03", "40"]])],
      "USD",
    );
    expect(history.points).toEqual([{ date: "2026-11-03", value: 150 }]);
  });

  it("sorts oldest first, whatever order SnapTrade sends", () => {
    const history = combineHistory([account("A", [["2026-11-03", "2"], ["2026-11-02", "1"]])], "USD");
    expect(history.points.map((point) => point.date)).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("says why an account is missing: add-on off, failed, or no history yet", () => {
    const history = combineHistory(
      [
        { name: "Off", status: 403, ok: false, data: {} },
        { name: "Broken", status: 500, ok: false, data: {} },
        account("New", []),
      ],
      "USD",
    );
    expect(history.points).toEqual([]);
    expect(history.missing).toEqual([
      { name: "Off", reason: "Balance history isn't turned on for this app" },
      { name: "Broken", reason: "Didn't load (status 500)" },
      { name: "New", reason: "No history yet" },
    ]);
  });

  it("skips unusable rows instead of counting them as $0", () => {
    const history = combineHistory([account("A", [["2026-11-02", ""], ["2026-11-03", "5"], ["not a date", "9"]])], "USD");
    expect(history.points).toEqual([{ date: "2026-11-03", value: 5 }]);
  });

  it("converts to the report's currency, and leaves out currencies it has no rate for", () => {
    const history = combineHistory([account("US", [["2026-11-02", "100"]]), account("EU", [["2026-11-02", "1"]], "EUR")], "CAD");
    expect(history.points[0].value).toBeCloseTo(139.78);
    expect(history.converted).toBe(true);
    expect(history.missing).toEqual([{ name: "EU", reason: "No exchange rate for EUR" }]);
  });
});

describe("gaps in the history", () => {
  it("keeps a weekend together but splits at a two-week gap", () => {
    const points = ["2026-10-02", "2026-10-05", "2026-10-19"].map((date) => ({ date, value: 1 }));
    expect(splitAtGaps(points).map((run) => run.length)).toEqual([2, 1]);
  });
});
