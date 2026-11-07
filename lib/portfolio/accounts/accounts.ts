// Accounts grouped by brokerage connection, for the account picker and the page
// title. One SnapTrade sign-in can share several connections (SnapTrade Sandbox,
// Wealthsimple), and each connection can hold several accounts (Individual, IRA).
// No UI here, so the naming rules are tested.
import { listOf } from "../../display/format/format";
import { rowsIn, type SnapTradeAccount, type SnapTradeConnection } from "../../snaptrade/responses/responses";
import { toNumber, toText } from "../holdings/holdings";

export type AccountChoice = {
  id: string;
  name: string; // "TFSA", not "Wealthsimple Trade TFSA": the brokerage is the group's name.
  total?: { amount: number; currency: string }; // SnapTrade's own total, in the account's currency.
};

export type AccountGroup = {
  id: string; // The connection (brokerage_authorization) ID.
  name: string; // "SnapTrade Sandbox", "Wealthsimple"
  accounts: AccountChoice[];
};

// Brokerages often repeat their own name in the account's: "Wealthsimple Trade TFSA"
// under "Wealthsimple Trade". The picker shows the brokerage once, as the group.
function shortAccountName(name: string, institution: string | undefined): string {
  if (institution && name.toLowerCase().startsWith(`${institution.toLowerCase()} `)) {
    return name.slice(institution.length).trim();
  }
  return name;
}

// `connections` is the /authorizations response: it names each brokerage.
export function groupAccounts(accounts: { account?: SnapTradeAccount }[], connections: unknown): AccountGroup[] {
  const connectionList = rowsIn<SnapTradeConnection>(connections);
  const groups = new Map<string, AccountGroup>();

  for (const { account } of accounts) {
    const id = toText(account?.id);
    if (!id) continue;
    const connectionId = toText(account?.brokerage_authorization) ?? "unknown";
    const connection = connectionList.find((row) => toText(row?.id) === connectionId);
    const institution = toText(account?.institution_name);
    // SnapTrade's display name ("SnapTrade Sandbox") reads better than the
    // institution name on the account ("sandbox"), so it comes first.
    const groupName =
      toText(connection?.brokerage?.display_name) ?? toText(connection?.brokerage?.name) ?? institution ?? "Brokerage";

    const group = groups.get(connectionId) ?? { id: connectionId, name: groupName, accounts: [] };
    const amount = toNumber(account?.balance?.total?.amount);
    const currency = toText(account?.balance?.total?.currency);
    group.accounts.push({
      id,
      name: shortAccountName(toText(account?.name) ?? "Account", institution),
      total: amount !== null && currency ? { amount, currency } : undefined,
    });
    groups.set(connectionId, group);
  }
  return [...groups.values()];
}

// The page title: what's being shown, in the words SnapTrade uses.
export function selectionTitle(groups: AccountGroup[], selected: Set<string>): string {
  const allAccounts = groups.flatMap((group) => group.accounts);
  const chosen = allAccounts.filter((account) => selected.has(account.id));
  if (chosen.length === 0) return "No account chosen";
  if (chosen.length === 1) {
    const group = groups.find((candidate) => candidate.accounts.some((account) => account.id === chosen[0].id))!;
    return `${group.name} · ${chosen[0].name}`;
  }
  if (chosen.length === allAccounts.length) return allAccounts.length === 1 ? groups[0].name : "All accounts";
  // Exactly one whole brokerage chosen: name the brokerage.
  const wholeGroups = groups.filter((group) => group.accounts.every((account) => selected.has(account.id)));
  if (wholeGroups.length === 1 && wholeGroups[0].accounts.length === chosen.length) return wholeGroups[0].name;
  return `${chosen.length} of ${allAccounts.length} accounts`;
}

// The summary's "what's counted" line, so the page always says which accounts it adds up.
export function includesText(groups: AccountGroup[], selected: Set<string>): string {
  const allAccounts = groups.flatMap((group) => group.accounts);
  const chosenNames = allAccounts.filter((account) => selected.has(account.id)).map((account) => account.name);
  if (chosenNames.length === allAccounts.length) {
    return allAccounts.length === 1
      ? `Includes ${chosenNames[0]}.`
      : `Includes all ${allAccounts.length} accounts: ${listOf(chosenNames)}.`;
  }
  return `Includes ${chosenNames.length} of ${allAccounts.length} accounts: ${listOf(chosenNames)}.`;
}
