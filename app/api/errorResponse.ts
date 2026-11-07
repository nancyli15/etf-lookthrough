// The error answer shared by the routes that call SnapTrade. Not a route itself:
// Next.js only makes URLs from files named route.ts.
import { NextResponse } from "next/server";
import { NotSignedInError } from "@/lib/snaptrade/api/api";

// Signed out (or the refresh failed): 401, so the page sends the user to sign in.
// Anything else: 502, "SnapTrade or the network failed". Logs only the message, never tokens.
export function errorResponse(err: unknown, whatFailed: string): NextResponse {
  if (err instanceof NotSignedInError) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  console.error(`${whatFailed} failed:`, err instanceof Error ? err.message : "unknown");
  return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
}
