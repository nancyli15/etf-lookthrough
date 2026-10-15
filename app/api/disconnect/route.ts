// In-app disconnect: revoke the refresh token at SnapTrade, then delete local tokens.
import { NextResponse, type NextRequest } from "next/server";
import { revokeRefreshToken } from "@/lib/oauth";
import { clearSession, getSession } from "@/lib/session";

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
  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
