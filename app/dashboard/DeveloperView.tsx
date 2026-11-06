// Shows exactly what SnapTrade sent for this page, one API call per row, so a
// number on the page can be checked against its source, and a failed call is
// easy to spot. Nothing here is calculated: it's the raw responses from /api/raw.
import { positionsOf } from "../../lib/holdings";
import type { ApiResponse, DashboardData } from "./Dashboard";

// A short summary of each response, so the row says what came back without opening it.
function summaryOf(name: string, data: unknown): string {
  if (name === "positions") return countOf(positionsOf(data).length, "position");
  if (name === "balances") return countOf(Array.isArray(data) ? data.length : 0, "currency", "currencies");
  // /activities wraps its list as { data: [...] }. Accept a bare list too.
  const list = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  return countOf(Array.isArray(list) ? list.length : 0, "activity", "activities");
}

function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type CallRowProps = { path: string; status: number; ok: boolean; summary: string; data: unknown };

function CallRow({ path, status, ok, summary, data }: CallRowProps) {
  return (
    <details className="call">
      <summary>
        <code className="call-path">{path}</code>
        <span className={ok ? "call-status" : "call-status error"}>
          {status} {ok ? "OK" : "failed"}
        </span>
        <span className="muted small">{ok ? summary : "Open to see the error"}</span>
      </summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}

export default function DeveloperView({ data }: { data: DashboardData }) {
  const calls: { name: "positions" | "balances" | "activities"; label: string }[] = [
    { name: "positions", label: "/positions/all" },
    { name: "balances", label: "/balances" },
    { name: "activities", label: "/activities" },
  ];

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
            Same data as below, for every account, in one file. It includes account numbers, so don't share it.
          </span>
        </div>
        <p className="muted small spaced">
          Fetched {new Date(data.fetchedAt).toLocaleString()}. The account value chart loads separately, from
          /api/history.
        </p>
      </div>

      {!data.accountsCall.ok && (
        <div className="card">
          <CallRow path="/accounts" status={data.accountsCall.status} ok={false} summary="" data={data.accountsRaw} />
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
        </div>
      ))}
    </details>
  );
}
