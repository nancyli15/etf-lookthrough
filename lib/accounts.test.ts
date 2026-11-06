import { describe, expect, it } from "vitest";
import { groupAccounts, includesText, selectionTitle } from "./accounts";

// Shaped like the real /accounts and /authorizations responses, with made-up IDs.
const account = (id: string, name: string, institution: string, connection: string, amount: number, currency: string) => ({
  account: { id, name, institution_name: institution, brokerage_authorization: connection, balance: { total: { amount, currency } } },
});
const accounts = [
  account("ind", "Individual", "sandbox", "c-sandbox", 68851.25, "USD"),
  account("ira", "IRA", "sandbox", "c-sandbox", 36774.60064, "USD"),
  account("tfsa", "Wealthsimple Trade TFSA", "Wealthsimple Trade", "c-ws", 6535.95, "CAD"),
  account("fhsa", "Wealthsimple Trade FHSA", "Wealthsimple Trade", "c-ws", 18.59, "CAD"),
];
const connections = [
  { id: "c-sandbox", brokerage: { name: "sandbox", display_name: "SnapTrade Sandbox" } },
  { id: "c-ws", brokerage: { name: "wealthsimple", display_name: "Wealthsimple" } },
];
const groups = groupAccounts(accounts, connections);
const pick = (...ids: string[]) => new Set(ids);

describe("accounts grouped by brokerage", () => {
  it("groups accounts under SnapTrade's brokerage name, with short account names and their totals", () => {
    expect(groups.map((group) => group.name)).toEqual(["SnapTrade Sandbox", "Wealthsimple"]);
    expect(groups[1].accounts.map((choice) => choice.name)).toEqual(["TFSA", "FHSA"]);
    expect(groups[0].accounts[0].total).toEqual({ amount: 68851.25, currency: "USD" });
  });

  it("falls back to the account's institution name when /authorizations didn't load", () => {
    expect(groupAccounts(accounts, undefined)[1].name).toBe("Wealthsimple Trade");
  });

  it("titles the page with what's shown", () => {
    expect(selectionTitle(groups, pick("ind", "ira", "tfsa", "fhsa"))).toBe("All accounts");
    expect(selectionTitle(groups, pick("tfsa"))).toBe("Wealthsimple · TFSA");
    expect(selectionTitle(groups, pick("ind", "ira"))).toBe("SnapTrade Sandbox");
    expect(selectionTitle(groups, pick("ind", "tfsa"))).toBe("2 of 4 accounts");
  });

  it("uses the brokerage name when there's only one account", () => {
    const one = groupAccounts([accounts[2]], connections);
    expect(selectionTitle(one, pick("tfsa"))).toBe("Wealthsimple · TFSA");
  });

  it("says which accounts the totals include", () => {
    expect(includesText(groups, pick("ind", "ira", "tfsa", "fhsa"))).toBe(
      "Includes all 4 accounts: Individual, IRA, TFSA and FHSA.",
    );
    expect(includesText(groups, pick("tfsa", "fhsa"))).toBe("Includes 2 of 4 accounts: TFSA and FHSA.");
  });
});
