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
import { formatMoney } from "@/lib/format";
import { emptyAccountsMessage } from "@/lib/connections";
import type { HistoryLoad } from "@/lib/history";
import type { Report, ReportCurrency } from "@/lib/report";
import AccountPicker from "./AccountPicker";
import CurrencySwitch from "./CurrencySwitch";
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

  // The account picker and the currency switch. null means "the default": every
  // account, in the accounts' own currency. That's what /api/raw already calculated,
  // so the default view needs no extra request.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [currency, setCurrency] = useState<ReportCurrency | null>(null);
  const [customReport, setCustomReport] = useState<Report | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const latestRequest = useRef(0);

  const groups = useMemo(
    () => (dashboardData ? groupAccounts(dashboardData.accounts, dashboardData.connectionsCall?.data) : []),
    [dashboardData],
  );
  const allIds = useMemo(() => groups.flatMap((group) => group.accounts.map((account) => account.id)), [groups]);
  const chosen = selected ?? new Set(allIds);
  // Only once accounts have loaded: before that, there are none to choose, which isn't the same as unticking them all.
  const noneChosen = allIds.length > 0 && chosen.size === 0;
  const isDefault = (selected === null || selected.size === allIds.length) && currency === null;

  // A different mix of accounts, or a different currency: send just those accounts
  // back to /api/report to recalculate. It doesn't call SnapTrade, so switching
  // often can't hit SnapTrade's rate limit.
  function recalculate(nextSelected: Set<string>, nextCurrency: ReportCurrency | null) {
    if (!dashboardData) return;
    const all = nextSelected.size === allIds.length;
    setSelected(all ? null : nextSelected);
    setCurrency(nextCurrency);
    // Nothing chosen, or back to the default: no request needed.
    if (nextSelected.size === 0 || (all && nextCurrency === null)) {
      latestRequest.current++;
      setCustomReport(null);
      setRecalculating(false);
      return;
    }
    setRecalculating(true);
    // Quick clicks can send several requests. Only the newest one's answer is used.
    const request = ++latestRequest.current;
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accounts: dashboardData.accounts.filter((account) => nextSelected.has(account.account?.id)),
        currency: nextCurrency ?? undefined,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = await response.json();
        if (request === latestRequest.current) setCustomReport(body.report);
      })
      .catch((error) => {
        if (request === latestRequest.current) setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      })
      .finally(() => {
        if (request === latestRequest.current) setRecalculating(false);
      });
  }

  const report = noneChosen ? null : isDefault ? (dashboardData?.report ?? null) : customReport;
  // What the switch shows: the chosen currency, or the one the page is in.
  const shownCurrency: ReportCurrency = currency ?? (report?.result.currency === "CAD" ? "CAD" : "USD");
  const showingAll = selected === null || selected.size === allIds.length;
  // The chart adds up only the chosen accounts' history.
  const shownHistory: HistoryLoad =
    history.state === "loaded" && !showingAll
      ? { ...history, accounts: history.accounts.filter((account) => account.id && chosen.has(account.id)) }
      : history;

  const moneyIn = (value: number, currency: string) => formatMoney(value, currency);

  return (
    <>
      {/* The same title in every state, so the header never changes size or jumps.
          Which accounts are shown is on the picker button and in the summary. */}
      <div className="page-header">
        <div className="page-title">
          <h1>ETF Look-Through</h1>
          <p className="muted">See the companies inside your funds, and how much of your money really sits in each.</p>
          {email && <p className="muted small">Signed in as {email}</p>}
        </div>
        <div className="page-controls">
          {allIds.length > 0 && (
            <CurrencySwitch value={shownCurrency} onChange={(next) => recalculate(chosen, next)} />
          )}
          <AccountPicker groups={groups} selected={chosen} onChange={(next) => recalculate(next, currency)} money={moneyIn} />
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

      {recalculating && <div className="card muted small">Recalculating…</div>}
      {noneChosen && (
        <div className="card">
          <h2>No account chosen</h2>
          <p className="muted">Pick one or more accounts above to see what you own.</p>
        </div>
      )}
      {report && dashboardData && dashboardData.accounts.length > 0 && (
        <LookThrough
          report={report}
          history={shownHistory}
          title={groups.length ? selectionTitle(groups, chosen) : undefined}
          includes={allIds.length > 1 ? includesText(groups, chosen) : undefined}
        />
      )}

      {dashboardData && <DeveloperView data={dashboardData} history={history} />}
    </>
  );
}
