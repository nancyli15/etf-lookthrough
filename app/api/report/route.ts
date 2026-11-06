// Recalculates the look-through for the accounts the user ticked in the account
// picker. It doesn't call SnapTrade: the browser already has each account's raw
// data from /api/raw and sends back the ones to include. The calculation runs
// here because the fund data is on the server only.
//
// It only accepts signed-in users, so it isn't an open calculator for anyone.
import { NextResponse, type NextRequest } from "next/server";
import { buildReport, type AccountData } from "@/lib/report";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Each account sends positions, balances and activities. 50 is far more than a
// person has, and stops someone sending a huge request.
const MAX_ACCOUNTS = 50;

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  let body: { accounts?: unknown; currency?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { accounts, currency } = body ?? {};
  if (!Array.isArray(accounts) || accounts.length > MAX_ACCOUNTS) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // The currency switch. Only the two currencies the app has a rate for.
  if (currency !== undefined && currency !== "USD" && currency !== "CAD") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // This is the user's own data from /api/raw, and buildReport reads every field
  // defensively, the same as it does for SnapTrade's responses.
  return NextResponse.json({ report: buildReport(accounts as AccountData[], { currency }) });
}
