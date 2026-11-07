// Fetches each account's estimated value history from SnapTrade's beta
// /balanceHistory endpoint. Kept separate from /api/raw on purpose: if the beta
// fails or changes, only the chart is affected and the rest of the page loads.
import { NextResponse } from "next/server";
import type { HistoryResponse } from "@/lib/portfolio/history/history";
import { accountsIn, createClient } from "@/lib/snaptrade/api/api";
import { errorResponse } from "../errorResponse";

// Run on every request, never from a cache: every user's data is different.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await createClient();
    const accounts = await client.get("/accounts");
    if (!accounts.ok) {
      return NextResponse.json({ error: "accounts_failed", status: accounts.status }, { status: 502 });
    }

    const responses: HistoryResponse[] = [];
    // One after another, like /api/raw: each call counts toward the per-account limit.
    for (const account of accountsIn(accounts)) {
      const result = await client.get(`/accounts/${encodeURIComponent(account.id)}/balanceHistory`);
      // The ID lets the Developer view match this to the account from /api/raw, which
      // already sends it. The account number isn't included.
      responses.push({ id: account.id, name: account.name ?? "Account", status: result.status, ok: result.ok, data: result.data });
    }

    return NextResponse.json({ fetchedAt: new Date().toISOString(), accounts: responses });
  } catch (err) {
    return errorResponse(err, "History fetch");
  }
}
