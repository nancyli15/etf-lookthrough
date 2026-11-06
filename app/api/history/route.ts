// Fetches each account's estimated value history from SnapTrade's beta
// /balanceHistory endpoint. Kept separate from /api/raw on purpose: if the beta
// fails or changes, only the chart is affected and the rest of the page loads.
import { NextResponse } from "next/server";
import type { HistoryResponse } from "@/lib/history";
import { NotSignedInError, createClient } from "@/lib/snaptrade";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await createClient();
    const accounts = await client.get("/accounts");
    if (!accounts.ok) {
      return NextResponse.json({ error: "accounts_failed", status: accounts.status }, { status: 502 });
    }

    const list = Array.isArray(accounts.data) ? accounts.data : [];
    const responses: HistoryResponse[] = [];
    // One after another, like /api/raw: each call counts toward the per-account limit.
    for (const account of list as { id?: string; name?: string }[]) {
      if (!account.id) continue;
      const result = await client.get(`/accounts/${encodeURIComponent(account.id)}/balanceHistory`);
      // Only the name goes back to the browser, not the account ID or number.
      responses.push({ name: account.name ?? "Account", status: result.status, ok: result.ok, data: result.data });
    }

    return NextResponse.json({ fetchedAt: new Date().toISOString(), accounts: responses });
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    console.error("History fetch failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
