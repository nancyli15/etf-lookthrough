"use client";
// Loads the signed-in user's data, then shows the look-through. The raw API
// responses stay available in the Developer view, at the bottom.
//
// Two calls, one after the other: /api/raw, then /api/history. Refresh tokens can
// be used once, so if both ran at the same moment with an expiring token, both would
// refresh and the second would sign the user out. Waiting for /api/raw means its
// refreshed token is already saved when /api/history starts.
import { useEffect, useMemo, useRef, useState } from "react";
import { groupAccounts, includesText, selectionTitle } from "@/lib/accounts";
import { emptyAccountsMessage } from "@/lib/connections";
import type { HistoryLoad } from "@/lib/history";
import type { Report } from "@/lib/report";
import AccountPicker from "./AccountPicker";
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
  accountsRaw?: unknown; // Original /accounts response, when it failed or held no accounts we could read
  connectionsCall?: ApiResponse; // /authorizations: brokerage names, and why there are no accounts
  report: Report | null; // The look-through, calculated on the server from the data above
};

export default function Dashboard({ email }: { email?: string }) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryLoad>({ state: "loading" });

  useEffect(() => {
    fetch("/api/raw")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/?error=session_expired";
          return;
        }
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const data: DashboardData = await response.json();
        setDashboardData(data);
        if (data.accountsCall.ok && data.accounts.length > 0) loadHistory();
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Something went wrong"));

    // Only after /api/raw has finished: see the note at the top of this file.
    function loadHistory() {
      fetch("/api/history")
        .then(async (response) => {
          if (!response.ok) throw new Error(`status ${response.status}`);
          const body = await response.json();
          setHistory({ state: "loaded", fetchedAt: body.fetchedAt, accounts: body.accounts ?? [] });
        })
        .catch((error) => setHistory({ state: "failed", message: error instanceof Error ? error.message : "unknown error" }));
    }
  }, []);

  // The account picker. null means every account, which is what /api/raw already
  // calculated, so the default view needs no extra request.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const latestRequest = useRef(0);

  const groups = useMemo(
    () => (dashboardData ? groupAccounts(dashboardData.accounts, dashboardData.connectionsCall?.data) : []),
    [dashboardData],
  );
  const allIds = useMemo(() => groups.flatMap((group) => group.accounts.map((account) => account.id)), [groups]);
  const chosen = selected ?? new Set(allIds);
  const showingAll = selected === null || selected.size === allIds.length;

  // A different mix of accounts: send just those back to /api/report to recalculate.
  // It doesn't call SnapTrade, so switching often can't hit SnapTrade's rate limit.
  function choose(next: Set<string>) {
    if (!dashboardData) return;
    if (next.size === allIds.length) {
      setSelected(null);
      setSelectedReport(null);
      return;
    }
    setSelected(next);
    setRecalculating(true);
    // Quick clicks can send several requests. Only the newest one's answer is used.
    const request = ++latestRequest.current;
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: dashboardData.accounts.filter((account) => next.has(account.account?.id)) }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = await response.json();
        if (request === latestRequest.current) setSelectedReport(body.report);
      })
      .catch((error) => {
        if (request === latestRequest.current) setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      })
      .finally(() => {
        if (request === latestRequest.current) setRecalculating(false);
      });
  }

  const report = showingAll ? (dashboardData?.report ?? null) : selectedReport;
  // The chart adds up only the chosen accounts' history.
  const shownHistory: HistoryLoad =
    history.state === "loaded" && !showingAll
      ? { ...history, accounts: history.accounts.filter((account) => account.id && chosen.has(account.id)) }
      : history;

  function moneyIn(value: number, currency: string): string {
    try {
      return value.toLocaleString(undefined, { style: "currency", currency });
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          {/* The title says what's being added up, in SnapTrade's names: "Wealthsimple · TFSA". */}
          <h1>{groups.length ? selectionTitle(groups, chosen) : "What you actually own"}</h1>
          <p className="muted">
            {groups.length ? "What you actually own" : null}
            {groups.length && email ? " · " : null}
            {email && <>Signed in as {email}</>}
          </p>
        </div>
        <div className="row">
          <AccountPicker groups={groups} selected={chosen} onChange={choose} money={moneyIn} />
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
          <p className="muted">{emptyAccountsMessage(dashboardData.accountsRaw, dashboardData.connectionsCall)}</p>
        </div>
      )}

      {recalculating && <div className="card muted small">Recalculating for these accounts…</div>}
      {report && dashboardData && dashboardData.accounts.length > 0 && (
        <LookThrough report={report} history={shownHistory} includes={groups.length > 1 || allIds.length > 1 ? includesText(groups, chosen) : undefined} />
      )}

      {dashboardData && <DeveloperView data={dashboardData} history={history} />}
    </>
  );
}
