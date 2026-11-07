// Fetches the raw SnapTrade data for the signed-in user: accounts, then each
// account's positions, balances and activities. Statuses are kept per call so
// we can see exactly what the API returns.
//
// It also builds the look-through report here, on the server, because the fund
// data (every holding of every fund) is too big to send to the browser.
// Add ?download=1 to save the raw responses as a JSON file, without the report.
import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/snaptrade/config/config";
import { buildReport, type AccountData } from "@/lib/analysis/report/report";
import { NotSignedInError, createClient, type ApiResult } from "@/lib/snaptrade/api/api";

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
        positions: await client.get(`${base}/positions/all`),
        balances: await client.get(`${base}/balances`),
        activities: await client.get(`${base}/activities`),
      });
    }

    // The connections this sign-in shares: their brokerage names ("SnapTrade Sandbox",
    // "Wealthsimple") label the account picker, and with no accounts they say why
    // (see lib/portfolio/connections/connections.ts). One call per page, not per account.
    const noAccounts = accounts.ok && perAccount.length === 0;
    const connections = accounts.ok ? await client.get("/authorizations") : undefined;

    const body = {
      fetchedAt: new Date().toISOString(),
      apiBase: API_BASE,
      accountsCall: { path: accounts.path, status: accounts.status, ok: accounts.ok },
      accounts: perAccount,
      accountsRaw: accounts.ok && !noAccounts ? undefined : accounts.data,
      connectionsCall: connections
        ? { path: connections.path, status: connections.status, ok: connections.ok, data: connections.data }
        : undefined,
    };

    const download = req.nextUrl.searchParams.get("download") === "1";
    // The download is what SnapTrade sent, so it leaves out our calculated report.
    // /accounts is outside data; buildReport reads every field defensively.
    const report = accounts.ok ? buildReport(perAccount as AccountData[]) : null;
    return NextResponse.json(download ? body : { ...body, report }, {
      headers: download
        ? { "Content-Disposition": `attachment; filename="raw-data-${Date.now()}.json"` }
        : {},
    });
  } catch (err) {
    if (err instanceof NotSignedInError) {
      // The download link is opened directly, so a person sees this response: send them to sign in.
      if (req.nextUrl.searchParams.get("download") === "1") {
        return NextResponse.redirect(new URL("/?error=session_expired", req.url));
      }
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    console.error("Raw data fetch failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
