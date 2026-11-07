// Explains an empty account list. SnapTrade answers /accounts with 200 and [] for
// several different reasons, and "No accounts yet" alone doesn't say which:
//   - no brokerage is shared with this sign-in (each OAuth sign-in can be its own user)
//   - a connection exists but is disabled, its accounts are hidden from apps,
//     or it hasn't synced any accounts yet
//   - SnapTrade sent accounts in a shape this app doesn't read
// /api/raw calls /authorizations only in this case, to tell them apart.
import { listOf } from "../../display/format/format";
import { rowsIn, type SnapTradeConnection } from "../../snaptrade/responses/responses";
import { toText } from "../holdings/holdings";

export type CallResult = { status: number; ok: boolean; data: unknown };

type Connection = { name: string; disabled: boolean };

function connectionsOf(data: unknown): Connection[] {
  return rowsIn<SnapTradeConnection>(data).map((row) => ({
    name: toText(row?.brokerage?.display_name) ?? toText(row?.brokerage?.name) ?? toText(row?.name) ?? "A brokerage",
    disabled: row?.disabled === true,
  }));
}

// "Wealthsimple and Questrade", each brokerage once.
function namesOf(connections: Connection[]): string {
  return listOf([...new Set(connections.map((connection) => connection.name))]);
}

export function emptyAccountsMessage(accountsRaw: unknown, connectionsCall?: CallResult): string {
  // An empty list is a real answer. Anything else that isn't a list is a shape we don't read.
  if (accountsRaw !== undefined && !(Array.isArray(accountsRaw) && accountsRaw.length === 0)) {
    return "SnapTrade sent its account list in a shape this app doesn't read yet. The Developer view below shows exactly what it sent.";
  }
  if (!connectionsCall) return "SnapTrade returned no accounts for this sign-in.";
  if (!connectionsCall.ok) {
    return `SnapTrade returned no accounts for this sign-in, and its list of connections didn't load (status ${connectionsCall.status}).`;
  }
  const connections = connectionsOf(connectionsCall.data);
  if (connections.length === 0) {
    return "No brokerage is shared with this sign-in. Disconnect, sign in again, and choose a brokerage on SnapTrade's screen.";
  }
  const active = connections.filter((connection) => !connection.disabled);
  if (active.length === 0) {
    return `Your ${namesOf(connections)} connection is disabled. Reconnect it in SnapTrade, then sign in again.`;
  }
  // Accounts marked "Hidden" in SnapTrade come back exactly like this: the connection is
  // active, but /accounts is empty. That was the real cause the first time this appeared.
  return `Your ${namesOf(active)} connection has no accounts this app can see. Its accounts may be hidden from apps in SnapTrade, or it may still be syncing.`;
}
