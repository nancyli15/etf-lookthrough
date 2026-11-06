"use client";
// Loads the signed-in user's data, then shows the look-through. The raw API
// responses stay available in the Developer view, at the bottom.
import { useEffect, useState } from "react";
import type { Report } from "@/lib/report";
import DeveloperView from "./DeveloperView";
import LookThrough from "./LookThrough";

// The result of one SnapTrade API call, as packaged by /api/raw.
export type ApiResponse = {
  path: string;   // API endpoint that was called
  status: number; // HTTP status code
  ok: boolean;    // Whether the request succeeded
  data: unknown;  // Response body, exactly as SnapTrade sent it
};

// One brokerage account and the results of its API requests.
export type AccountData = {
  account: any;            // Brokerage account information (name, ID, institution, etc.)
  positions: ApiResponse;  // Stocks, ETFs, and other investments held in the account
  balances: ApiResponse;   // Cash and account balances
  activities: ApiResponse; // Transactions and account activity
};

// The complete response from our /api/raw endpoint, covering all connected accounts.
export type DashboardData = {
  fetchedAt: string; // When the data was retrieved
  accountsCall: { status: number; ok: boolean }; // Result of the request for the user's accounts
  accounts: AccountData[];
  accountsRaw?: unknown; // Original accounts response, for debugging failed requests
  report: Report | null; // The look-through, calculated on the server from the data above
};

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

  const report = dashboardData?.report ?? null;

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

      {dashboardData && <DeveloperView data={dashboardData} />}
    </>
  );
}
