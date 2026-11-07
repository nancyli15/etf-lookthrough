// Shows exactly what SnapTrade sent for this page, one API call per row, so a
// number on the page can be checked against its source, and a failed call is
// easy to spot. Rows are SnapTrade's raw responses from /api/raw and /api/history.
// The one exception, "Our calculation", is labelled as ours.
import { positionsOf } from "../../../lib/portfolio/holdings";
import type { HistoryLoad } from "../../../lib/portfolio/history";
import type { Report } from "../../../lib/analysis/report";
import type { ApiResponse, DashboardData } from "../Dashboard";
import "./DeveloperView.css";

// SnapTrade's per-account limit, shared by every account-data call (see TRADEOFFS.md).
const ACCOUNT_LIMIT_PER_MINUTE = 10;
const COMPANIES_SHOWN = 10;

// A short summary of each response, so the row says what came back without opening it.
function summaryOf(name: string, data: unknown): string {
  if (name === "positions") return countOf(positionsOf(data).length, "position");
  if (name === "balances") return countOf(Array.isArray(data) ? data.length : 0, "currency", "currencies");
  if (name === "history") {
    const body = data as { history?: unknown; currency?: unknown };
    const days = Array.isArray(body?.history) ? body.history.length : 0;
    return `${countOf(days, "day")}${typeof body?.currency === "string" ? `, in ${body.currency}` : ""}`;
  }
  // /activities wraps its list as { data: [...] }. Accept a bare list too.
  const list = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  return countOf(Array.isArray(list) ? list.length : 0, "activity", "activities");
}

function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

// The report's headline numbers, plus the first few companies. The full report
// can hold thousands of companies, which would make this row slow to open.
function reportSummary(report: Report) {
  const { result } = report;
  return {
    currency: result.currency,
    netWorth: report.netWorth,
    holdings: result.total,
    cash: report.cash,
    snapTradeTotal: report.brokerageTotal,
    differsFromSnapTrade: report.differsFromBrokerage,
    companies: result.companies.length,
    [`first${COMPANIES_SHOWN}Companies`]: result.companies.slice(0, COMPANIES_SHOWN).map((company) => ({
      symbol: company.symbol,
      total: company.total,
      direct: company.direct,
      byFund: company.byFund,
      percent: company.percent,
    })),
    funds: result.funds,
    otherInFunds: result.otherInFunds,
    insideUnopenedFunds: result.insideUnopenedFunds,
    notLookedThrough: result.notLookedThrough,
    skipped: report.skipped,
    failedAccounts: report.failedAccounts,
    activitySince: report.activitySince,
    fxAsOf: result.fxAsOf,
  };
}

type CallRowProps = { path: string; status?: number; ok: boolean; summary: string; data: unknown; note?: string };

function CallRow({ path, status, ok, summary, data, note }: CallRowProps) {
  return (
    <details className="call">
      <summary>
        <code className="call-path">{path}</code>
        <span className={ok ? "call-status" : "call-status error"}>
          {status === undefined ? "" : `${status} ${ok ? "OK" : "failed"}`}
        </span>
        <span className="muted small">{ok ? summary : "Open to see the error"}</span>
      </summary>
      {note && <p className="muted small">{note}</p>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

function HistoryRow({ history, accountId }: { history: HistoryLoad; accountId?: string }) {
  const path = "/balanceHistory";
  if (history.state === "loading") {
    return (
      <div className="call call-plain">
        <code className="call-path">{path}</code>
        <span className="muted small">Loading…</span>
      </div>
    );
  }
  if (history.state === "failed") {
    return (
      <div className="call call-plain">
        <code className="call-path">{path}</code>
        <span className="error small">/api/history failed ({history.message})</span>
      </div>
    );
  }
  const response = history.accounts.find((account) => account.id === accountId);
  if (!response) {
    return (
      <div className="call call-plain">
        <code className="call-path">{path}</code>
        <span className="muted small">Not in /api/history's response</span>
      </div>
    );
  }
  return (
    <CallRow
      path={path}
      status={response.status}
      ok={response.ok}
      summary={`Beta. ${summaryOf("history", response.data)}`}
      data={response.data}
      note="Estimated by SnapTrade. A 403 means the add-on isn't turned on."
    />
  );
}

export default function DeveloperView({ data, history }: { data: DashboardData; history: HistoryLoad }) {
  const calls: { name: "positions" | "balances" | "activities"; label: string }[] = [
    { name: "positions", label: "/positions/all" },
    { name: "balances", label: "/balances" },
    { name: "activities", label: "/activities" },
  ];
  const accounts = data.accounts.length;
  // /api/raw: /accounts, then 3 per account. /api/history: /accounts again, then 1 per account.
  // /api/history only runs when there are accounts (see Dashboard.tsx).
  const historyCalls = history.state === "loading" || !data.accountsCall.ok || accounts === 0 ? 0 : 1 + accounts;
  const connectionsCalls = data.connectionsCall ? 1 : 0;
  const totalCalls = 1 + 3 * accounts + historyCalls + connectionsCalls;
  const perAccount = 3 + (historyCalls ? 1 : 0);

  return (
    <details className="developer">
      <summary className="muted">Developer view: what SnapTrade sent</summary>
      <div className="card">
        <p>
          The exact API responses behind this page. Use it to check a number against its source, or to see which call
          failed.
        </p>
        <div className="row">
          <a className="button secondary" href="/api/raw?download=1">Download all as JSON</a>
          <span className="muted small">
            SnapTrade's responses from /api/raw, for every account, in one file. It includes account numbers, so don't
            share it.
          </span>
        </div>
        {accounts > 0 ? (
          <p className="small spaced">
            This page made <strong>{countOf(totalCalls, "call")}</strong> to SnapTrade: /accounts{" "}
            {historyCalls ? "twice" : "once"}
            {connectionsCalls ? ", /authorizations once" : ""}, and {perAccount} per account. Where SnapTrade's
            per-account limit applies, it's {ACCOUNT_LIMIT_PER_MINUTE} a minute, so refreshing more than twice a minute
            can hit it. Changing which accounts are shown doesn't call SnapTrade again.
          </p>
        ) : (
          <p className="small spaced">
            This page made <strong>{countOf(totalCalls, "call")}</strong> to SnapTrade: /accounts
            {connectionsCalls ? ", then /authorizations to see why there are no accounts" : ""}.
          </p>
        )}
        <p className="muted small">
          /api/raw fetched {new Date(data.fetchedAt).toLocaleString()}
          {history.state === "loaded" && <>, /api/history fetched {new Date(history.fetchedAt).toLocaleString()}</>}.
        </p>
      </div>

      {(!data.accountsCall.ok || data.accounts.length === 0 || data.connectionsCall) && (
        <div className="card">
          <h2>This sign-in</h2>
          {/* With accounts, each one's /accounts row is in its own card below. */}
          {(!data.accountsCall.ok || data.accounts.length === 0) && (
            <CallRow
              path="/accounts"
              status={data.accountsCall.status}
              ok={data.accountsCall.ok}
              summary={Array.isArray(data.accountsRaw) ? countOf(data.accountsRaw.length, "account") : "Not a list"}
              data={data.accountsRaw}
            />
          )}
          {data.connectionsCall && (
            <CallRow
              path="/authorizations"
              status={data.connectionsCall.status}
              ok={data.connectionsCall.ok}
              summary={
                Array.isArray(data.connectionsCall.data)
                  ? `${countOf(data.connectionsCall.data.length, "connection")} shared with this sign-in`
                  : "Not a list"
              }
              data={data.connectionsCall.data}
              note="The brokerage connections this sign-in shares. Their names label the account picker."
            />
          )}
        </div>
      )}

      {data.accounts.map((accountData, accountIndex) => (
        <div className="card" key={accountData.account?.id ?? accountIndex}>
          <h2>
            {accountData.account?.name ?? "Account"}{" "}
            <span className="muted">{accountData.account?.institution_name ?? ""}</span>
          </h2>
          <CallRow
            path="/accounts"
            status={data.accountsCall.status}
            ok
            summary="Account details and SnapTrade's total"
            data={accountData.account}
          />
          {calls.map((call) => {
            const response: ApiResponse = accountData[call.name];
            return (
              <CallRow
                key={call.name}
                path={call.label}
                status={response.status}
                ok={response.ok}
                summary={summaryOf(call.name, response.data)}
                data={response.data}
              />
            );
          })}
          <HistoryRow history={history} accountId={accountData.account?.id} />
        </div>
      ))}

      {data.report && (
        <div className="card">
          <h2>
            Our calculation <span className="muted">not from SnapTrade</span>
          </h2>
          <CallRow
            path="report"
            ok
            summary={`What the page shows, worked out on the server from the responses above. ${
              data.report.result.companies.length > COMPANIES_SHOWN
                ? `First ${COMPANIES_SHOWN} of ${data.report.result.companies.length.toLocaleString()} companies`
                : countOf(data.report.result.companies.length, "company", "companies")
            }`}
            data={reportSummary(data.report)}
          />
        </div>
      )}
    </details>
  );
}
