// Accounts grouped by brokerage connection, for the account picker and the page
// title. One SnapTrade sign-in can share several connections (SnapTrade Sandbox,
// Wealthsimple), and each connection can hold several accounts (Individual, IRA).
// No UI here, so the naming rules are tested.
import { toNumber } from "./holdings";

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

type RawAccount = {
  id?: unknown;
  name?: unknown;
  institution_name?: unknown;
  brokerage_authorization?: unknown;
  balance?: { total?: { amount?: unknown; currency?: unknown } };
};

type RawConnection = { id?: unknown; brokerage?: { display_name?: unknown; name?: unknown } };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

// Brokerages often repeat their own name in the account's: "Wealthsimple Trade TFSA"
// under "Wealthsimple Trade". The picker shows the brokerage once, as the group.
function shortAccountName(name: string, institution: string | undefined): string {
  if (institution && name.toLowerCase().startsWith(`${institution.toLowerCase()} `)) {
    return name.slice(institution.length).trim();
  }
  return name;
}

export function groupAccounts(accounts: { account?: RawAccount }[], connections: unknown): AccountGroup[] {
  const connectionList: RawConnection[] = Array.isArray(connections) ? connections : [];
  const groups = new Map<string, AccountGroup>();

  for (const { account } of accounts) {
    const id = text(account?.id);
    if (!id) continue;
    const connectionId = text(account?.brokerage_authorization) ?? "unknown";
    const connection = connectionList.find((row) => text(row?.id) === connectionId);
    const institution = text(account?.institution_name);
    // SnapTrade's display name ("SnapTrade Sandbox") reads better than the
    // institution name on the account ("sandbox"), so it comes first.
    const groupName =
      text(connection?.brokerage?.display_name) ?? text(connection?.brokerage?.name) ?? institution ?? "Brokerage";

    const group = groups.get(connectionId) ?? { id: connectionId, name: groupName, accounts: [] };
    const amount = toNumber(account?.balance?.total?.amount);
    const currency = text(account?.balance?.total?.currency);
    group.accounts.push({
      id,
      name: shortAccountName(text(account?.name) ?? "Account", institution),
      total: amount !== null && currency ? { amount, currency } : undefined,
    });
    groups.set(connectionId, group);
  }
  return [...groups.values()];
}

function listOf(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// The page title: what's being shown, in the words SnapTrade uses.
export function selectionTitle(groups: AccountGroup[], selected: Set<string>): string {
  const all = groups.flatMap((group) => group.accounts);
  const chosen = all.filter((account) => selected.has(account.id));
  if (chosen.length === 1) {
    const group = groups.find((candidate) => candidate.accounts.some((account) => account.id === chosen[0].id))!;
    return `${group.name} · ${chosen[0].name}`;
  }
  if (chosen.length === all.length) return all.length === 1 ? groups[0].name : "All accounts";
  const fullGroups = groups.filter((group) => group.accounts.every((account) => selected.has(account.id)));
  if (fullGroups.length === 1 && fullGroups[0].accounts.length === chosen.length) return fullGroups[0].name;
  return `${chosen.length} of ${all.length} accounts`;
}

// The summary's "what's counted" line, so the page always says which accounts it adds up.
export function includesText(groups: AccountGroup[], selected: Set<string>): string {
  const all = groups.flatMap((group) => group.accounts);
  const chosen = all.filter((account) => selected.has(account.id)).map((account) => account.name);
  if (chosen.length === all.length) {
    return all.length === 1 ? `Includes ${chosen[0]}.` : `Includes all ${all.length} accounts: ${listOf(chosen)}.`;
  }
  return `Includes ${chosen.length} of ${all.length} accounts: ${listOf(chosen)}.`;
}
