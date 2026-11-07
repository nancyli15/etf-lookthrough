// Explains an empty account list. SnapTrade answers /accounts with 200 and [] for
// several different reasons, and "No accounts yet" alone doesn't say which:
//   - no brokerage is shared with this sign-in (each OAuth sign-in can be its own user)
//   - a connection exists but is disabled, its accounts are hidden from apps,
//     or it hasn't synced any accounts yet
//   - SnapTrade sent accounts in a shape this app doesn't read
// /api/raw calls /authorizations only in this case, to tell them apart.

export type CallResult = { status: number; ok: boolean; data: unknown };

type Connection = { name: string; disabled: boolean };

function connectionsOf(data: unknown): Connection[] {
  const list = Array.isArray(data) ? data : [];
  return list.map((row) => ({
    name: String(row?.brokerage?.display_name ?? row?.brokerage?.name ?? row?.name ?? "A brokerage"),
    disabled: row?.disabled === true,
  }));
}

function namesOf(connections: Connection[]): string {
  const names = [...new Set(connections.map((connection) => connection.name))];
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
