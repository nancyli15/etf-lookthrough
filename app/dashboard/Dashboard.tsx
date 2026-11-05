"use client";
// Loads the signed-in user's data, then shows the look-through. The per-account
// tables and raw JSON stay available in a Developer view.
import { useEffect, useMemo, useState } from "react";
import { positionsOf, toNumber } from "@/lib/holdings";
import { buildReport } from "@/lib/report";
import LookThrough from "./LookThrough";

// The result of one SnapTrade API call, as packaged by /api/raw.
type ApiResponse = {
  path: string;   // API endpoint that was called
  status: number; // HTTP status code
  ok: boolean;    // Whether the request succeeded
  data: unknown;  // Response body, exactly as SnapTrade sent it
};

// One brokerage account and the results of its API requests.
type AccountData = {
  account: any;            // Brokerage account information (name, ID, institution, etc.)
  positions: ApiResponse;  // Stocks, ETFs, and other investments held in the account
  balances: ApiResponse;   // Cash and account balances
  activities: ApiResponse; // Transactions and account activity
};

// The complete response from our /api/raw endpoint, covering all connected accounts.
type DashboardData = {
  fetchedAt: string; // When the data was retrieved
  accountsCall: { status: number; ok: boolean }; // Result of the request for the user's accounts
  accounts: AccountData[];
  accountsRaw?: unknown; // Original accounts response, for debugging failed requests
};

// Returns a position's ticker symbol, such as "AAPL" or "VOO".
// /positions/all uses instrument.symbol. The rest handles older formats.
function getPositionSymbol(position: any): string {
  if (typeof position?.instrument?.symbol === "string") return position.instrument.symbol;

  const symbolData = position?.symbol;
  const nestedSymbol = symbolData?.symbol;
  if (typeof nestedSymbol === "string") return nestedSymbol;
  if (typeof nestedSymbol?.symbol === "string") return nestedSymbol.symbol;
  if (typeof symbolData?.raw_symbol === "string") return symbolData.raw_symbol;
  return "?";
}

// Returns the investment type, such as stock or ETF.
function getPositionType(position: any): string {
  return position?.instrument?.kind ?? position?.symbol?.symbol?.type?.code ?? "";
}

// Returns a position's currency code. It can arrive as "USD" or { code: "USD" }.
function getPositionCurrency(position: any): string {
  const currencyData = position?.currency ?? position?.instrument?.currency ?? position?.symbol?.symbol?.currency;
  if (typeof currencyData === "string") return currencyData;
  return currencyData?.code ?? "";
}

// Formats a value for display: 1234.56789 becomes "1,234.5679", and unusable values become "–".
function formatNumber(value: unknown): string {
  const numericValue = toNumber(value);
  return numericValue === null ? "–" : numericValue.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function Dashboard({ email }: { email?: string }) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/raw")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/?error=session_expired";
          return;
        }
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        setDashboardData(await response.json());
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Something went wrong"));
  }, []);

  const report = useMemo(
    () => (dashboardData?.accountsCall.ok ? buildReport(dashboardData.accounts) : null),
    [dashboardData],
  );

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>What you actually own</h1>
          {email && <p className="muted">Signed in as {email}</p>}
        </div>
        <div className="row">
          <form action="/api/disconnect" method="post">
            <button className="button secondary" type="submit">Disconnect</button>
          </form>
        </div>
      </div>

      {errorMessage && <div className="card error">Couldn't load your data: {errorMessage}. Try refreshing.</div>}
      {!dashboardData && !errorMessage && <div className="card muted">Loading your accounts…</div>}

      {dashboardData && !dashboardData.accountsCall.ok && (
        <div className="card error">
          SnapTrade couldn't load your accounts right now (status {dashboardData.accountsCall.status}). Try refreshing.
        </div>
      )}

      {dashboardData && dashboardData.accountsCall.ok && dashboardData.accounts.length === 0 && (
        <div className="card">
          <h2>No accounts yet</h2>
          <p className="muted">
            Connect a brokerage in your SnapTrade Dashboard, then refresh this page.
          </p>
        </div>
      )}

      {report && dashboardData && dashboardData.accounts.length > 0 && <LookThrough report={report} />}

      {dashboardData && (
        <details className="developer">
          <summary className="muted">Developer view</summary>
          <p className="spaced">
            <a className="button secondary" href="/api/raw?download=1">Download raw data</a>
          </p>
          {!dashboardData.accountsCall.ok && <pre>{JSON.stringify(dashboardData.accountsRaw, null, 2)}</pre>}
          {dashboardData.accounts.map((accountData, accountIndex) => {
            const positions = positionsOf(accountData.positions.data);
            return (
              <div className="card" key={accountData.account?.id ?? accountIndex}>
                <h2>
                  {accountData.account?.name ?? "Account"}{" "}
                  <span className="muted">{accountData.account?.institution_name ?? ""}</span>
                </h2>
                {!accountData.positions.ok ? (
                  <p className="error">Positions request returned status {accountData.positions.status}.</p>
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
                      {positions.map((position, positionIndex) => (
                        <tr key={positionIndex}>
                          <td>{getPositionSymbol(position)}</td>
                          <td>{getPositionType(position)}</td>
                          <td className="num">{formatNumber(position?.units ?? position?.fractional_units)}</td>
                          <td className="num">{formatNumber(position?.price)}</td>
                          <td>{getPositionCurrency(position)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <details style={{ marginTop: 12 }}>
                  <summary className="muted">Raw JSON for this account</summary>
                  <pre>{JSON.stringify(accountData, null, 2)}</pre>
                </details>
              </div>
            );
          })}
          <p className="muted">Fetched {new Date(dashboardData.fetchedAt).toLocaleString()}</p>
        </details>
      )}
    </>
  );
}
