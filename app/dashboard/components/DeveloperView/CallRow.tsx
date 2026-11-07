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

export function HistoryRow({ history, accountId }: { history: HistoryLoad; accountId?: string }) {
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
