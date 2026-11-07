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
import { NotSignedInError, accountsIn, createClient, type ApiResult } from "@/lib/snaptrade/api/api";
import { errorResponse } from "../errorResponse";

// Run on every request, never from a cache: every user's data is different.
export const dynamic = "force-dynamic";

// One account and SnapTrade's three answers about it.
type AccountResponses = {
  account: unknown;
  positions: ApiResult;
  balances: ApiResult;
  activities: ApiResult;
};

export async function GET(req: NextRequest) {
  // ?download=1 saves the raw responses as a file, without our report.
  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  try {
    const client = await createClient();
    const accounts = await client.get("/accounts");

    const perAccount: AccountResponses[] = [];
    // Sequential on purpose: simple, and avoids hammering the API.
    for (const { id, raw } of accountsIn(accounts)) {
      const accountPath = `/accounts/${encodeURIComponent(id)}`;
      perAccount.push({
        account: raw,
        positions: await client.get(`${accountPath}/positions/all`),
        balances: await client.get(`${accountPath}/balances`),
        activities: await client.get(`${accountPath}/activities`),
      });
    }

    // The connections this sign-in shares: their brokerage names ("SnapTrade Sandbox",
    // "Wealthsimple") label the account picker, and with no accounts they say why
    // (see lib/portfolio/connections/connections.ts). One call per page, not per account.
    const connections = accounts.ok ? await client.get("/authorizations") : undefined;
    // The raw /accounts answer is only needed when it failed or held nothing we could read.
    const needsRawAccounts = !accounts.ok || perAccount.length === 0;

    const body = {
      fetchedAt: new Date().toISOString(),
      apiBase: API_BASE,
      accountsCall: { path: accounts.path, status: accounts.status, ok: accounts.ok },
      accounts: perAccount,
      accountsRaw: needsRawAccounts ? accounts.data : undefined,
      connectionsCall: connections
        ? { path: connections.path, status: connections.status, ok: connections.ok, data: connections.data }
        : undefined,
    };

    if (isDownload) {
      // What SnapTrade sent, without our calculated report. Content-Disposition makes the browser save it as a file.
      return NextResponse.json(body, {
        headers: { "Content-Disposition": `attachment; filename="raw-data-${Date.now()}.json"` },
      });
    }
    // /accounts is outside data; buildReport reads every field defensively.
    const report = accounts.ok ? buildReport(perAccount as AccountData[]) : null;
    return NextResponse.json({ ...body, report });
  } catch (err) {
    // The download link is opened directly, so a person sees this response: send them to sign in.
    if (err instanceof NotSignedInError && isDownload) {
      return NextResponse.redirect(new URL("/?error=session_expired", req.url));
    }
    return errorResponse(err, "Raw data fetch");
  }
}
