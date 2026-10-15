// Fetches the raw SnapTrade data for the signed-in user: accounts, then each
// account's positions, balances and activities. Statuses are kept per call so
// we can see exactly what the API returns (Step 0: look at the raw data).
// Add ?download=1 to save the result as a JSON file.
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/config";
import { NotSignedInError, createClient, type ApiResult } from "@/lib/snaptrade";

export const dynamic = "force-dynamic";

type AccountDump = {
  account: unknown;
  positions: ApiResult;
  balances: ApiResult;
  activities: ApiResult;
};

export async function GET(req: NextRequest) {
  try {
    const client = await createClient();
    const accounts = await client.get("/accounts");

    const list = Array.isArray(accounts.data) ? accounts.data : [];
    const perAccount: AccountDump[] = [];
    // Sequential on purpose: simple, and avoids hammering the API.
    for (const account of list) {
      const id = (account as { id?: string }).id;
      if (!id) continue;
      const base = `/accounts/${encodeURIComponent(id)}`;
      perAccount.push({
        account,
        // /positions is deprecated (410 for new customers); /positions/all is the unified endpoint.
        positions: await client.get(`${base}/positions/all`),
        balances: await client.get(`${base}/balances`),
        activities: await client.get(`${base}/activities`),
      });
    }

    const body = {
      fetchedAt: new Date().toISOString(),
      apiBase: API_BASE,
      accountsCall: { path: accounts.path, status: accounts.status, ok: accounts.ok },
      accounts: perAccount,
      accountsRaw: accounts.ok ? undefined : accounts.data,
    };

    const download = req.nextUrl.searchParams.get("download") === "1";
    return NextResponse.json(body, {
      headers: download
        ? { "Content-Disposition": `attachment; filename="raw-data-${Date.now()}.json"` }
        : {},
    });
  } catch (err) {
    if (err instanceof NotSignedInError) {
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    console.error("Raw data fetch failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
