import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FUND_DATA_IS_SAMPLE } from "../../data/funds";
import { buildReport, type AccountData } from "../../lib/report";
import CompanyDetails from "./CompanyDetails";
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
    expect(html).toContain("Your companies");
    expect(html).toContain("Your funds");
    expect(html).toContain("Where your funds overlap");
    expect(html).toContain("SPY and FXAIX");
    expect(html).toContain("~100%");
    expect(html).toContain("BTC");
    expect(html).toContain("We don&#x27;t have this fund&#x27;s contents yet");
    expect(html).toContain("don&#x27;t include cash");
  });

  it("shows every company in one table, with a bar and where its money comes from", () => {
    const html = render([ok([position("AAPL", "stock", 500), position("SPY", "etf", 1000)])]);
    expect(html).toContain("Where it comes from");
    expect(html).toContain('class="bar direct"');
    expect(html).toContain('class="bar funds"');
    expect(html).toContain("US$500.00 you bought"); // The bar's label for screen readers, in full amounts.
    expect(html).toContain("US$500 you bought"); // The line under the bar, in whole dollars.
    expect(html).toContain("via SPY");
    // Filter buttons replace the separate direct and fund tables.
    expect(html).toContain("Bought directly");
    expect(html).toContain("Through funds");
    expect(html).toContain("Account value");
    expect(html).toContain("Share my top companies");
    expect(html).toContain("Copy image");
    // The old chart, breakdown card and separate tables are gone.
    expect(html).not.toContain("Your biggest companies"); // An old card, and a top-5 chart that repeated this table.
    expect(html).not.toContain("<h2>Companies inside your funds</h2>");
    expect(html).not.toContain("Both combined");
    // A company held only through funds shows no direct amount, not a dash.
    expect(html).not.toContain(">–<");
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
    expect(html).toContain("In all");
    expect(html).toContain("Total in your funds");
    expect(html).toContain("$1,850.00"); // 500 + 1000 + 100 + 250 cash.
    const summary = html.indexOf("Total net worth");
    const finding = html.indexOf("is your biggest company");
    const companies = html.indexOf("Your companies");
    const funds = html.indexOf("Your funds");
    expect(summary).toBeGreaterThan(-1);
    expect(finding).toBeGreaterThan(summary);
    // Companies come before funds: what you own is the point of the page.
    expect(companies).toBeGreaterThan(finding);
    expect(funds).toBeGreaterThan(companies);
    expect(html).not.toContain("This total is incomplete");
  });

  it("shows a money market fund inside cash, and splits crypto from other holdings", () => {
    const html = render([
      {
        positions: {
          ok: true,
          status: 200,
          data: {
            results: [
              position("BTC", "crypto", 100),
              position("ZZZZ", "etf", 50),
              { ...position("SPAXX", "mutualfund", 200), cash_equivalent: true },
            ],
          },
        },
        balances: { ok: true, data: [{ currency: { code: "USD" }, cash: 300 }] },
      },
    ]);
    // In the ⓘ next to "Cash", not a line under it.
    expect(html).toContain('aria-label="About the cash in your accounts"');
    expect(html).toContain("Includes US$200.00 in SPAXX, a money market fund.");
    // Crypto and a fund we can't open share one row of the summary.
    expect(html).toContain("Crypto and other");
    expect(html).toContain("$450.00"); // 100 + 50 + 300, with SPAXX inside the cash.
    expect(html).not.toContain("Not looked through</td>");
    expect(html).not.toContain("<td>SPAXX");
  });

  it("warns when the total disagrees with SnapTrade's", () => {
    const html = render([
      {
        account: { name: "IRA", balance: { total: { amount: 1000, currency: "USD" } } },
        positions: { ok: true, status: 200, data: { results: [position("AAPL", "stock", 1500)] } },
        balances: { ok: true, data: [] },
      },
    ]);
    expect(html).toContain("SnapTrade reports US$1,000.00");
    expect(html).toContain("may be off by US$500.00");
  });

  it("uses one short name per company and doesn't total shares", () => {
    const html = render([
      {
        positions: {
          ok: true,
          status: 200,
          data: {
            results: [
              { ...position("NVDA", "stock", 100), instrument: { kind: "stock", symbol: "NVDA", description: "NVIDIA Corporation", currency: "USD" } },
              position("SPY", "etf", 1000),
            ],
          },
        },
      },
    ]);
    expect(html).toContain("NVIDIA <span");
    expect(html).not.toContain("Nvidia");
    expect(html).not.toContain("NVIDIA Corporation");
    // Shares of different companies can't be added up, so no table totals them.
    expect(html).not.toMatch(/\d+ shares total/);
  });

  it("doesn't repeat a name that's the same as its symbol", () => {
    const html = render([
      {
        positions: {
          ok: true,
          status: 200,
          data: { results: [{ ...position("USDC", "crypto", 100), instrument: { kind: "crypto", symbol: "USDC", description: "USDC", currency: "USD" } }] },
        },
      },
    ]);
    expect(html).not.toContain("Usdc");
    expect(html).toContain("Crypto has no companies inside");
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

  it("shows the FX date when it converts", () => {
    const html = render([ok([position("XEQT", "etf", 1000, "CAD"), position("AAPL", "stock", 100)])]);
    expect(html).toContain("CAD per USD");
  });

  // Needs the real XEF file (see scripts/fetch_fund_data.mjs).
  it.skipIf(FUND_DATA_IS_SAMPLE)("lists a fund held inside another fund that we can't open, like IEFA inside XEF", () => {
    const html = render([ok([position("XEF", "etf", 1000, "CAD")])]);
    expect(html).toContain("IEFA");
    expect(html).toContain("Held inside one of your funds");
    // IEFA is about 1.5% of XEF, too small to call the totals understated.
    expect(html).not.toContain("likely understated");
  });

  it("doesn't warn about understated totals when nothing large is unopened", () => {
    const html = render([ok([position("SPY", "etf", 1000)])]);
    expect(html).not.toContain("likely understated");
  });
});

describe("company dropdown", () => {
  const sell = {
    type: "SELL",
    symbol: { symbol: "AAPL", raw_symbol: "AAPL" },
    trade_date: "2026-10-10T15:00:00Z",
    units: -5,
    price: 180.5,
    amount: 902.5,
    currency: { code: "USD" },
  };
  const report = buildReport([
    {
      positions: { ok: true, status: 200, data: { results: [position("AAPL", "stock", 500), position("SPY", "etf", 1000)] } },
      activities: { ok: true, data: { data: [sell] } },
    },
  ]);
  const apple = report.result.companies.find((company) => company.symbol === "AAPL")!;
  const html = renderToStaticMarkup(
    <CompanyDetails
      company={apple}
      funds={report.result.funds}
      holdingsTotal={report.result.total}
      activities={report.recentActivity.AAPL}
      activitySince={report.activitySince}
      activityNotLoaded={report.activityNotLoaded}
      money={(value) => `$${value.toFixed(2)}`}
    />,
  );

  it("answers all five: more than shown, inside each fund, what if, which part you control, recent", () => {
    expect(html).toContain("Your brokerage shows you bought $500.00 (1 share) directly");
    expect(html).toContain("Inside SPY:");
    expect(html).toContain("your holdings move about");
    expect(html).toContain("You control the $500.00 in your own shares");
    expect(html).toContain("Sold 5 shares for $902.50 ($180.50 each)");
  });

  it("shows the activity section even with nothing to list, with how far back history goes", () => {
    const spyOnly = buildReport([
      {
        account: { name: "Individual", sync_status: { transactions: { first_transaction_date: "2026-09-16" } } },
        positions: { ok: true, status: 200, data: { results: [position("SPY", "etf", 1000)] } },
        activities: { ok: true, data: { data: [] } },
      },
    ]);
    expect(spyOnly.activitySince).toBe("2026-09-16");
    const company = spyOnly.result.companies[0];
    const markup = renderToStaticMarkup(
      <CompanyDetails
        company={company}
        funds={spyOnly.result.funds}
        holdingsTotal={spyOnly.result.total}
        activities={[]}
        activitySince={spyOnly.activitySince}
        activityNotLoaded={[]}
        money={(value) => `$${value.toFixed(2)}`}
      />,
    );
    expect(markup).toContain("Your own trades in");
    expect(markup).toContain("directly since");
    expect(markup).toContain("2026");
  });

  it("has a slider for the size of the move, from 0% to 100%, starting at 10%", () => {
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('value="10"');
    expect(html).toContain("on the shares you bought and");
    expect(html).toContain("Together, your holdings move about");
  });
});

describe("your funds card", () => {
  const html = render([ok([position("SPY", "etf", 1000), position("XEQT", "etf", 1000, "CAD"), position("AAPL", "stock", 1000)])]);

  it("puts how much is matched to companies in an ⓘ note, not a column", () => {
    expect(html).not.toContain(">Matched to companies<");
    expect(html).toContain("About SPY&#x27;s contents");
    expect(html).toContain("is matched to named companies");
    expect(html).toContain("is cash, futures or currency contracts inside the");
  });

  // Needs XEQT, which the sample data for a fresh clone doesn't have.
  it.skipIf(FUND_DATA_IS_SAMPLE)("shows each fund's share of your funds, with a donut of fund sizes", () => {
    expect(html).toContain("Of your funds");
    expect(html).toContain("in funds"); // The donut's centre label.
  });

  // Needs XEQT, which the sample data for a fresh clone doesn't have.
  it.skipIf(FUND_DATA_IS_SAMPLE)("links each fund's name to its companies, and adds a filter button per fund", () => {
    expect(html).toContain('title="Show the companies inside SPY">SPY</button>');
    expect(html).toContain('title="Show the companies inside XEQT">XEQT</button>');
    // In the company table, after All / Bought directly / Through funds.
    expect(html).toMatch(/Through funds<\/button><button[^>]*>SPY<\/button>/);
  });

  // Needs XEQT, which the sample data for a fresh clone doesn't have.
  it.skipIf(FUND_DATA_IS_SAMPLE)("shows overlap as a ranked list of pairs, led by the biggest pair in dollars", () => {
    expect(html).toContain("Your biggest overlap");
    expect(html).toContain('<span class="overlap-pair">SPY + XEQT</span>');
    expect(html).toContain("How overlap is measured"); // The ⓘ that defines the percentage.
    // The old grid, and the "duplicated money" figure that read like money wasted.
    expect(html).not.toContain("overlap-grid");
    expect(html).not.toContain("of your money is in the same companies through both");
  });
});

describe("your biggest company, under the headline", () => {
  it("gives the total and the part through funds, and doesn't repeat the company table", () => {
    const html = render([ok([position("AAPL", "stock", 500), position("SPY", "etf", 1000)])]);
    expect(html).toContain("so you own "); // "…so you own 15% more of it than your shares alone."
    expect(html).toContain("through your funds</p>");
    expect(html).toMatch(/\d+\.\d% of your AAPL name/); // The test data names Apple "AAPL name".
    expect(html).not.toContain("Your biggest companies"); // The top-5 chart that repeated the table.
  });

  it("isn't shown for a company you only bought yourself", () => {
    expect(render([ok([position("AAPL", "stock", 500)])])).not.toContain("insight-tiles");
  });
});

describe("long company tables", () => {
  it("gives the company total in one line, with the rest of holdings in the summary above", () => {
    const html = render([ok([position("AAPL", "stock", 500), position("SPY", "etf", 1000), position("BTC", "crypto", 100)])]);
    expect(html).toContain("in companies (");
    expect(html).toContain("of your holdings)");
    // The rest of holdings is in the summary's rows, not a sentence.
    expect(html).not.toContain("The rest of your holdings:");
    expect(html).toContain("<td>Crypto and other</td>");
    // The cash, futures and currency lines inside SPY are in an ⓘ on the Funds row.
    expect(html).toContain('aria-label="About the cash inside your funds"');
    expect(html).toContain("US$100.00");
  });

  it("has a search box and a count, and no page buttons for one page", () => {
    const html = render([ok([position("AAPL", "stock", 500)])]);
    expect(html).toContain("Search all companies");
    expect(html).toContain("Showing 1–1 of 1");
    expect(html).not.toContain("Next ›");
    expect(html).not.toContain("Show all");
  });

  // SPY's 503 companies need the real fund data (see scripts/fetch_fund_data.mjs).
  it.skipIf(FUND_DATA_IS_SAMPLE)("pages through SPY's companies 10 at a time", () => {
    const html = render([ok([position("SPY", "etf", 1000)])]);
    expect(html).toMatch(/Showing 1–10 of \d{3}/);
    expect(html).toContain("Next ›");
  });
});
