import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HistoryLoad } from "../../lib/history";
import { buildReport } from "../../lib/report";
import type { DashboardData } from "./Dashboard";
import DeveloperView from "./DeveloperView";

const ok = (data: unknown) => ({ path: "", status: 200, ok: true, data });

function dashboard(accounts: number): DashboardData {
  const list = Array.from({ length: accounts }, (_, index) => ({
    account: { id: `acc-${index}`, name: `Account ${index}`, institution_name: "sandbox" },
    positions: ok({ results: [] }),
    balances: ok([]),
    activities: ok({ data: [] }),
  }));
  return { fetchedAt: "2026-11-05T12:00:00Z", accountsCall: { status: 200, ok: true }, accounts: list, report: buildReport(list) };
}

// <details> starts closed, but its contents are still in the markup, so tests can read them.
const render = (data: DashboardData, history: HistoryLoad) => renderToStaticMarkup(<DeveloperView data={data} history={history} />);

describe("Developer view", () => {
  it("shows each account's /balanceHistory response, matched by account ID", () => {
    const html = render(dashboard(2), {
      state: "loaded",
      fetchedAt: "2026-11-05T12:00:01Z",
      accounts: [
        { id: "acc-1", name: "Account 1", status: 403, ok: false, data: { detail: "not enabled" } },
        { id: "acc-0", name: "Account 0", status: 200, ok: true, data: { history: [{}, {}, {}], currency: "USD" } },
      ],
    });
    expect(html).toContain("/balanceHistory");
    expect(html).toContain("Beta. 3 days, in USD");
    expect(html).toContain("403 failed");
    // Account 0's card comes first, with its 200, even though /api/history listed it second.
    const account0 = html.indexOf('200 OK</span><span class="muted small">Beta. 3 days');
    expect(account0).toBeGreaterThan(-1);
    expect(account0).toBeLessThan(html.indexOf("403 failed"));
  });

  it("counts the calls against SnapTrade's per-account limit: 2 + 4 per account", () => {
    const html = render(dashboard(2), { state: "loaded", fetchedAt: "2026-11-05T12:00:01Z", accounts: [] });
    expect(html).toContain("<strong>10 calls</strong>");
    expect(html).toContain("/accounts twice, and 4 per account");
    expect(html).toContain("10 a minute");
  });

  it("doesn't count /api/history while it's still loading", () => {
    const html = render(dashboard(1), { state: "loading" });
    expect(html).toContain("<strong>4 calls</strong>");
    expect(html).toContain("Loading…");
  });

  it("says when /api/history failed", () => {
    expect(render(dashboard(1), { state: "failed", message: "status 502" })).toContain("/api/history failed (status 502)");
  });

  it("labels our calculated report as not from SnapTrade", () => {
    const html = render(dashboard(1), { state: "loading" });
    expect(html).toContain("Our calculation");
    expect(html).toContain("not from SnapTrade");
    expect(html).toContain("netWorth");
  });
});
