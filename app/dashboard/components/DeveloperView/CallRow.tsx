// One API call in the Developer view: path, status and a summary, opening to the raw JSON.
import type { HistoryLoad } from "@/lib/portfolio/history/history";
import { summaryOf } from "./summaries";

type CallRowProps = { path: string; status?: number; ok: boolean; summary: string; data: unknown; note?: string };

export function CallRow({ path, status, ok, summary, data, note }: CallRowProps) {
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

// A row that can't open yet: still loading, failed, or missing. Same layout, no arrow.
function PlainRow({ path, message, isError = false }: { path: string; message: string; isError?: boolean }) {
  return (
    <div className="call call-plain">
      <code className="call-path">{path}</code>
      <span className={isError ? "error small" : "muted small"}>{message}</span>
    </div>
  );
}

// The account's /balanceHistory row. It comes from /api/history, which loads after the rest.
export function HistoryRow({ history, accountId }: { history: HistoryLoad; accountId?: string }) {
  const path = "/balanceHistory";
  if (history.state === "loading") return <PlainRow path={path} message="Loading…" />;
  if (history.state === "failed") return <PlainRow path={path} message={`/api/history failed (${history.message})`} isError />;
  const response = history.accounts.find((account) => account.id === accountId);
  if (!response) return <PlainRow path={path} message="Not in /api/history's response" />;
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
