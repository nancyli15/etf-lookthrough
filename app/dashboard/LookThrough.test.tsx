import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildReport, type AccountData } from "../../lib/report";
import LookThrough from "./LookThrough";

function position(symbol: string, kind: string, value: number, currency = "USD") {
  return {
    instrument: { kind, symbol, description: `${symbol} name`, currency },
    units: "1",
    price: String(value),
    currency,
  };
}

function render(accounts: AccountData[]) {
  return renderToStaticMarkup(<LookThrough report={buildReport(accounts)} />);
}

const ok = (results: unknown[]) => ({ positions: { ok: true, status: 200, data: { results } } });

describe("LookThrough screen", () => {
  it("shows the headline, companies, overlap and what's left out for a Sandbox-style portfolio", () => {
    const html = render([
      ok([position("AAPL", "stock", 500), position("SPY", "etf", 1000), position("BTC", "crypto", 100)]),
      ok([position("FXAIX", "mutualfund", 1000), position("SPAXX", "mutualfund", 200)]),
    ]);
    expect(html).toContain("is your biggest company");
    expect(html).toContain("Stocks you bought directly");
    expect(html).toContain("Companies inside your funds");
    expect(html).toContain("Both combined, by company");
    expect(html).toContain("SPY and FXAIX");
    expect(html).toContain("About 100%");
    expect(html).toContain("BTC");
    expect(html).toContain("We don&#x27;t have this fund&#x27;s contents yet");
    expect(html).toContain("don&#x27;t include cash");
  });

  it("opens with a net worth summary, then the biggest company, then the details", () => {
    const html = render([
      {
        positions: {
          ok: true,
          status: 200,
          data: { results: [position("AAPL", "stock", 500), position("SPY", "etf", 1000), position("BTC", "crypto", 100)] },
        },
        balances: { ok: true, data: [{ currency: { code: "USD" }, cash: 250 }] },
      },
    ]);
    expect(html).toContain("Total bought directly");
    expect(html).toContain("Total in your funds");
    expect(html).toContain("$1,850.00"); // 500 + 1000 + 100 + 250 cash.
    const summary = html.indexOf("Total net worth");
    const finding = html.indexOf("is your biggest company");
    const details = html.indexOf("The details");
    expect(summary).toBeGreaterThan(-1);
    expect(finding).toBeGreaterThan(summary);
    expect(details).toBeGreaterThan(finding);
    expect(html).not.toContain("This total is incomplete");
  });

  it("says net worth is incomplete when cash didn't load", () => {
    const html = render([
      {
        account: { name: "IRA" },
        positions: { ok: true, status: 200, data: { results: [position("AAPL", "stock", 500)] } },
        balances: { ok: false, data: null },
      },
    ]);
    expect(html).toContain("This total is incomplete");
    expect(html).toContain("Cash didn&#x27;t load for IRA");
  });

  it("warns about a failed account instead of quietly showing smaller totals", () => {
    const html = render([
      { account: { name: "IRA" }, positions: { ok: false, status: 500, data: null } },
      ok([position("AAPL", "stock", 500)]),
    ]);
    expect(html).toContain("load IRA");
  });

  it("shows a calm message and no tables when there's nothing to look through", () => {
    const html = render([ok([])]);
    expect(html).toContain("nothing to look through");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("in total");
  });

  it("doesn't present $0 as a real total when every account failed", () => {
    const html = render([{ account: { name: "IRA" }, positions: { ok: false, status: 500, data: null } }]);
    expect(html).toContain("load IRA");
    expect(html).not.toContain("in total");
  });

  it("says an unknown ETF isn't available yet, without crashing", () => {
    const html = render([ok([position("ZZZZ", "etf", 500)])]);
    expect(html).toContain("ZZZZ");
    expect(html).toContain("contents yet");
  });

  it("shows the FX date when it converts, and shows XEQT's unopened gap", () => {
    const html = render([ok([position("XEQT", "etf", 1000, "CAD"), position("AAPL", "stock", 100)])]);
    expect(html).toContain("CAD per USD");
    expect(html).toContain("ITOT");
    expect(html).toContain("inside funds we can&#x27;t open yet");
    expect(html).toContain("likely understated");
  });

  it("doesn't warn about understated totals when nothing large is unopened", () => {
    const html = render([ok([position("SPY", "etf", 1000)])]);
    expect(html).not.toContain("likely understated");
  });
});
