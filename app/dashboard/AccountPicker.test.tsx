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

describe("summary with several currencies", () => {
  const position = (symbol: string, kind: string, value: number, currency: string) => ({
    instrument: { kind, symbol, description: symbol, currency },
    units: "1",
    price: String(value),
    currency,
  });

  it("says US$ amounts were converted, next to the total, not only in the small print", () => {
    const report = buildReport([
      { positions: { ok: true, status: 200, data: { results: [position("AAPL", "stock", 100, "USD")] } } },
      { positions: { ok: true, status: 200, data: { results: [position("RY", "stock", 100, "CAD")] } } },
    ]);
    const html = renderToStaticMarkup(<LookThrough report={report} includes="Includes all 2 accounts: Individual and TFSA." />);
    expect(html).toContain("Includes all 2 accounts: Individual and TFSA.");
    expect(html).toContain("US$ amounts are converted to CA$ at 1.3978 CAD per USD");
  });
});
