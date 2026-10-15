"use client";
// Step-0 dashboard: shows each account and its positions, plus the raw JSON.
// The look-through view gets built on top of this once we've seen real data.
import { useEffect, useState } from "react";

type ApiResult = { path: string; status: number; ok: boolean; data: unknown };
type AccountDump = { account: any; positions: ApiResult; balances: ApiResult; activities: ApiResult };
type RawData = {
  fetchedAt: string;
  accountsCall: { status: number; ok: boolean };
  accounts: AccountDump[];
  accountsRaw?: unknown;
};

// /positions/all returns { results: [...] }; each item has an `instrument`
// (kind, symbol, raw_symbol, currency, ...). Older shapes nest under `symbol`.
// Read defensively and fall back to "?".
function positionsOf(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  const results = (data as { results?: unknown })?.results;
  return Array.isArray(results) ? results : [];
}
function symbolOf(p: any): string {
  if (typeof p?.instrument?.symbol === "string") return p.instrument.symbol;
  const s = p?.symbol;
  const inner = s?.symbol;
  if (typeof inner === "string") return inner;
  if (typeof inner?.symbol === "string") return inner.symbol;
  if (typeof s?.raw_symbol === "string") return s.raw_symbol;
  return "?";
}
function kindOf(p: any): string {
  return p?.instrument?.kind ?? p?.symbol?.symbol?.type?.code ?? "";
}
function currencyOf(p: any): string {
  const c = p?.currency ?? p?.instrument?.currency ?? p?.symbol?.symbol?.currency;
  if (typeof c === "string") return c;
  return c?.code ?? "";
}
// /positions/all returns units and price as strings ("5", "180.5"), so convert first.
function toNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
function num(v: unknown): string {
  const n = toNumber(v);
  return n === null ? "–" : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function Dashboard({ email }: { email?: string }) {
  const [data, setData] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/raw")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/?error=session_expired";
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setData(await res.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, []);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Your holdings</h1>
          {email && <p className="muted">Signed in as {email}</p>}
        </div>
        <div className="row">
          <a className="button secondary" href="/api/raw?download=1">Download raw data</a>
          <form action="/api/disconnect" method="post">
            <button className="button secondary" type="submit">Disconnect</button>
          </form>
        </div>
      </div>

      {error && <div className="card error">Couldn't load your data: {error}. Try refreshing.</div>}
      {!data && !error && <div className="card muted">Loading your accounts…</div>}

      {data && !data.accountsCall.ok && (
        <div className="card error">
          SnapTrade returned status {data.accountsCall.status} for your accounts.
          <pre>{JSON.stringify(data.accountsRaw, null, 2)}</pre>
        </div>
      )}

      {data && data.accountsCall.ok && data.accounts.length === 0 && (
        <div className="card">
          <h2>No accounts yet</h2>
          <p className="muted">
            Connect a brokerage in your SnapTrade Dashboard, then refresh this page.
          </p>
        </div>
      )}

      {data?.accounts.map((a, i) => {
        const positions = positionsOf(a.positions.data);
        return (
          <div className="card" key={a.account?.id ?? i}>
            <h2>
              {a.account?.name ?? "Account"}{" "}
              <span className="muted">{a.account?.institution_name ?? ""}</span>
            </h2>
            {!a.positions.ok ? (
              <p className="error">Positions request returned status {a.positions.status}.</p>
            ) : positions.length === 0 ? (
              <p className="muted">No positions in this account.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th className="num">Units</th>
                    <th className="num">Price</th>
                    <th>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, j) => (
                    <tr key={j}>
                      <td>{symbolOf(p)}</td>
                      <td>{kindOf(p)}</td>
                      <td className="num">{num(p?.units ?? p?.fractional_units)}</td>
                      <td className="num">{num(p?.price)}</td>
                      <td>{currencyOf(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <details style={{ marginTop: 12 }}>
              <summary className="muted">Raw JSON for this account</summary>
              <pre>{JSON.stringify(a, null, 2)}</pre>
            </details>
          </div>
        );
      })}

      {data && <p className="muted">Fetched {new Date(data.fetchedAt).toLocaleString()}</p>}
    </>
  );
}
