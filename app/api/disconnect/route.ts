// In-app disconnect: revoke the refresh token at SnapTrade, then delete local tokens.
import { NextResponse, type NextRequest } from "next/server";
import { revokeRefreshToken } from "@/lib/snaptrade/oauth/oauth";
import { clearSession, getSession } from "@/lib/snaptrade/session/session";

// Run on every request, never from a cache: every user's data is different.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  let revoked = true;
  if (session) {
    try {
      revoked = await revokeRefreshToken(session.refreshToken);
    } catch {
      revoked = false;
    }
  }
  // Clear local tokens either way; the user asked to disconnect.
  await clearSession();
  const target = revoked ? "/?disconnected=1" : "/?error=revoke_failed";
  // 303 "See Other": after a form POST, the browser loads the next page with a plain GET.
  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
