// Shows exactly what SnapTrade sent for this page, one API call per row, so a
// number on the page can be checked against its source, and a failed call is
// easy to spot. Rows are SnapTrade's raw responses from /api/raw and /api/history.
// The one exception, "Our calculation", is labelled as ours.
import type { HistoryLoad } from "@/lib/portfolio/history/history";
import type { ApiResult } from "@/lib/snaptrade/api/api";
import type { DashboardData } from "../../Dashboard";
import { CallRow, HistoryRow } from "./CallRow";
import { COMPANIES_SHOWN, countOf, reportSummary, summaryOf } from "./summaries";
import "./DeveloperView.css";

// SnapTrade's per-account limit, shared by every account-data call (see TRADEOFFS.md).
const ACCOUNT_LIMIT_PER_MINUTE = 10;

// The calls /api/raw makes for each account, in the order they're shown.
const ACCOUNT_CALLS: { name: "positions" | "balances" | "activities"; path: string }[] = [
  { name: "positions", path: "/positions/all" },
  { name: "balances", path: "/balances" },
  { name: "activities", path: "/activities" },
];

export default function DeveloperView({ data, history }: { data: DashboardData; history: HistoryLoad }) {
  const accountCount = data.accounts.length;
  // /api/raw: /accounts, then 3 per account. /api/history: /accounts again, then 1 per account.
  // /api/history only runs when there are accounts (see Dashboard.tsx).
  const historyCalls = history.state === "loading" || !data.accountsCall.ok || accountCount === 0 ? 0 : 1 + accountCount;
  const connectionsCalls = data.connectionsCall ? 1 : 0;
  const totalCalls = 1 + ACCOUNT_CALLS.length * accountCount + historyCalls + connectionsCalls;
  const callsPerAccount = ACCOUNT_CALLS.length + (historyCalls ? 1 : 0);

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
        {accountCount > 0 ? (
          <p className="small spaced">
            This page made <strong>{countOf(totalCalls, "call")}</strong> to SnapTrade: /accounts{" "}
            {historyCalls ? "twice" : "once"}
            {connectionsCalls ? ", /authorizations once" : ""}, and {callsPerAccount} per account. Where SnapTrade's
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
          {ACCOUNT_CALLS.map((call) => {
            const response: ApiResult = accountData[call.name];
            return (
              <CallRow
                key={call.name}
                path={call.path}
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
