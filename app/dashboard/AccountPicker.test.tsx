import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupAccounts } from "../../lib/accounts";
import { buildReport } from "../../lib/report";
import AccountPicker from "./AccountPicker";
import LookThrough from "./LookThrough";

const money = (value: number, currency: string) => `${currency} ${value.toFixed(2)}`;
const account = (id: string, name: string, connection: string, amount: number, currency: string) => ({
  account: { id, name, institution_name: "x", brokerage_authorization: connection, balance: { total: { amount, currency } } },
});
const connections = [
  { id: "a", brokerage: { display_name: "SnapTrade Sandbox" } },
  { id: "b", brokerage: { display_name: "Wealthsimple" } },
];

describe("account picker", () => {
  const groups = groupAccounts(
    [account("ind", "Individual", "a", 68851.25, "USD"), account("tfsa", "TFSA", "b", 6535.95, "CAD")],
    connections,
  );

  it("lists each brokerage with its accounts and SnapTrade's total in their own currency", () => {
    const html = renderToStaticMarkup(
      <AccountPicker groups={groups} selected={new Set(["ind", "tfsa"])} onChange={() => {}} money={money} />,
    );
    expect(html).toContain("Accounts: All 2");
    expect(html).toContain("SnapTrade Sandbox");
    expect(html).toContain("Wealthsimple");
    expect(html).toContain("USD 68851.25");
    expect(html).toContain("CAD 6535.95");
  });

  it("says how many are ticked", () => {
    const html = renderToStaticMarkup(<AccountPicker groups={groups} selected={new Set(["tfsa"])} onChange={() => {}} money={money} />);
    expect(html).toContain("Accounts: 1 of 2");
  });

  it("isn't shown with only one account", () => {
    const one = groupAccounts([account("tfsa", "TFSA", "b", 1, "CAD")], connections);
    expect(renderToStaticMarkup(<AccountPicker groups={one} selected={new Set(["tfsa"])} onChange={() => {}} money={money} />)).toBe("");
  });
});

describe("an account with only cash, like an empty FHSA", () => {
  it("stays in CAD, with no conversion and no notes about holdings", () => {
    const report = buildReport([
      {
        positions: { ok: true, status: 200, data: { results: [], data_freshness: { as_of: "2026-11-06T00:00:00Z" } } },
        balances: { ok: true, data: [{ currency: { code: "CAD" }, cash: 18.59 }] },
      },
    ]);
    const html = renderToStaticMarkup(<LookThrough report={report} />);
    expect(html).toContain("CA$18.59");
    expect(html).not.toContain("converted");
    expect(html).not.toContain("Converted at");
    expect(html).not.toContain("Holdings as of");
    expect(html).not.toContain("Percentages are of your holdings");
  });
});

describe("summary with several currencies", () => {
  const position = (symbol: string, kind: string, value: number, currency: string) => ({
    instrument: { kind, symbol, description: symbol, currency },
    units: "1",
    price: String(value),
    currency,
  });

  it("says USD amounts were converted, in an ⓘ next to the total", () => {
    const report = buildReport([
      { positions: { ok: true, status: 200, data: { results: [position("AAPL", "stock", 100, "USD")] } } },
      { positions: { ok: true, status: 200, data: { results: [position("RY", "stock", 100, "CAD")] } } },
    ]);
    const html = renderToStaticMarkup(<LookThrough report={report} />);
    expect(html).toContain('aria-label="About the exchange rate"');
    expect(html).toContain("US$ amounts are converted to CAD at 1.3978 CAD per USD");
  });
});
