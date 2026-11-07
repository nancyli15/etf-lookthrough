"use client";
// Loads the signed-in user's data, then shows the look-through. The raw API
// responses stay available in the Developer view, at the bottom.
//
// Two calls, one after the other: /api/raw, then /api/history. Refresh tokens can
// be used once, so if both ran at the same moment with an expiring token, both would
// refresh and the second would sign the user out. Waiting for /api/raw means its
// refreshed token is already saved when /api/history starts.
import { useEffect, useMemo, useRef, useState } from "react";
import { groupAccounts, includesText, selectionTitle } from "@/lib/portfolio/accounts/accounts";
import { formatMoney } from "@/lib/display/format/format";
import { emptyAccountsMessage } from "@/lib/portfolio/connections/connections";
import type { HistoryLoad } from "@/lib/portfolio/history/history";
import type { Report, ReportCurrency } from "@/lib/analysis/report/report";
import type { ApiResult } from "@/lib/snaptrade/api/api";
import AccountPicker from "./components/AccountPicker/AccountPicker";
import CurrencySwitch from "./components/CurrencySwitch/CurrencySwitch";
import DeveloperView from "./components/DeveloperView/DeveloperView";
import LookThrough from "./components/LookThrough/LookThrough";
import "./Dashboard.css";

// One brokerage account and SnapTrade's answers about it, as /api/raw sends them.
// Each ApiResult is { path, status, ok, data }, with `data` exactly as SnapTrade sent it.
export type AccountResponses = {
  account: any; // SnapTrade's account object: name, ID, institution, balance. Outside data, so read with care.
  positions: ApiResult; // Stocks, ETFs and other investments held in the account
  balances: ApiResult; // Cash, one row per currency
  activities: ApiResult; // Trades, dividends and other account activity
};

// The complete response from our /api/raw endpoint, covering all connected accounts.
export type DashboardData = {
  fetchedAt: string; // When the data was retrieved
  accountsCall: { status: number; ok: boolean }; // Result of the request for the user's accounts
  accounts: AccountResponses[];
  accountsRaw?: unknown; // Original /accounts response, when it failed or held no accounts we could read
  connectionsCall?: ApiResult; // /authorizations: brokerage names, and why there are no accounts
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
  const [pickedIds, setPickedIds] = useState<Set<string> | null>(null);
  const [pickedCurrency, setPickedCurrency] = useState<ReportCurrency | null>(null);
  const [customReport, setCustomReport] = useState<Report | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  // Counts /api/report requests, so a slow answer to an old click can be ignored.
  const latestRequestId = useRef(0);

  const groups = useMemo(
    () => (dashboardData ? groupAccounts(dashboardData.accounts, dashboardData.connectionsCall?.data) : []),
    [dashboardData],
  );
  const allIds = useMemo(() => groups.flatMap((group) => group.accounts.map((account) => account.id)), [groups]);
  // The accounts on screen: the picked ones, or all of them by default.
  const selectedIds = pickedIds ?? new Set(allIds);
  const showingAll = selectedIds.size === allIds.length;
  // Only once accounts have loaded: before that, there are none to choose, which isn't the same as unticking them all.
  const noneChosen = allIds.length > 0 && selectedIds.size === 0;
  const isDefault = showingAll && pickedCurrency === null;

  // A different mix of accounts, or a different currency: send just those accounts
  // back to /api/report to recalculate. It doesn't call SnapTrade, so switching
  // often can't hit SnapTrade's rate limit.
  function recalculate(nextIds: Set<string>, nextCurrency: ReportCurrency | null) {
    if (!dashboardData) return;
    const allPicked = nextIds.size === allIds.length;
    setPickedIds(allPicked ? null : nextIds);
    setPickedCurrency(nextCurrency);
    // Nothing chosen, or back to the default: no request needed.
    if (nextIds.size === 0 || (allPicked && nextCurrency === null)) {
      latestRequestId.current++; // Any request still in flight is now out of date.
      setCustomReport(null);
      setRecalculating(false);
      return;
    }
    setRecalculating(true);
    // Quick clicks can send several requests. Only the newest one's answer is used.
    const requestId = ++latestRequestId.current;
    const isLatest = () => requestId === latestRequestId.current;
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accounts: dashboardData.accounts.filter((accountResponses) => nextIds.has(accountResponses.account?.id)),
        currency: nextCurrency ?? undefined,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = await response.json();
        if (isLatest()) setCustomReport(body.report);
      })
      .catch((error) => {
        if (isLatest()) setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      })
      .finally(() => {
        if (isLatest()) setRecalculating(false);
      });
  }

  const report = noneChosen ? null : isDefault ? (dashboardData?.report ?? null) : customReport;
  // What the switch shows: the chosen currency, or the one the page is in.
  // With no account chosen there's no report, so fall back to the full report's currency
  // rather than US$: unticking everything shouldn't flip the switch.
  const pageCurrency = report?.result.currency ?? dashboardData?.report?.result.currency;
  const shownCurrency: ReportCurrency = pickedCurrency ?? (pageCurrency === "CAD" ? "CAD" : "USD");
  // The chart adds up only the chosen accounts' history.
  const shownHistory: HistoryLoad =
    history.state === "loaded" && !showingAll
      ? { ...history, accounts: history.accounts.filter((account) => account.id && selectedIds.has(account.id)) }
      : history;

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
            <CurrencySwitch value={shownCurrency} onChange={(next) => recalculate(selectedIds, next)} />
          )}
          <AccountPicker
            groups={groups}
            selected={selectedIds}
            onChange={(next) => recalculate(next, pickedCurrency)}
            money={(value, currency) => formatMoney(value, currency)}
          />
          <form action="/api/disconnect" method="post">
            <button className="button" type="submit">Disconnect</button>
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
          title={groups.length ? selectionTitle(groups, selectedIds) : undefined}
          includes={allIds.length > 1 ? includesText(groups, selectedIds) : undefined}
        />
      )}

      {dashboardData && <DeveloperView data={dashboardData} history={history} />}
    </>
  );
}
