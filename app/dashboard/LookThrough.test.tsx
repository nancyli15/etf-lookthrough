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
    expect(html).toContain("directly and through 2 funds");
    expect(html).toContain("Your largest companies");
    expect(html).toContain("SPY and FXAIX");
    expect(html).toContain("About 100%");
    expect(html).toContain("BTC");
    expect(html).toContain("We don&#x27;t have this fund&#x27;s contents yet");
    expect(html).toContain("Cash balances aren&#x27;t included");
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
