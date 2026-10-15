// Step 2 of sign-in: SnapTrade redirects back here with ?code=...&state=...
// We check state, exchange the code on the server, verify the id_token, and
// store the tokens in an encrypted cookie.
import { NextResponse, type NextRequest } from "next/server";
import { redirectUri } from "@/lib/config";
import { tokenRequest, verifyIdToken } from "@/lib/oauth";
import { saveSession, takeLoginState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, req.url));

  // Consumed immediately so state and verifier can never be reused.
  const login = await takeLoginState();
  const state = params.get("state");
  if (!login || !state || state !== login.state) return fail("state_mismatch");

  const oauthError = params.get("error");
  if (oauthError) return fail(oauthError === "access_denied" ? "access_denied" : "oauth_error");

  const code = params.get("code");
  if (!code) return fail("missing_code");

  try {
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: login.codeVerifier,
      redirect_uri: redirectUri(),
    });
    if (!tokens.id_token || !tokens.refresh_token) return fail("incomplete_token_response");

    const claims = await verifyIdToken(tokens.id_token, login.nonce);
    // The id_token is a one-time sign-in proof: copy the claims we need and discard it.

    await saveSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ?? "",
      userId: String(claims.sub),
      email: claims.email_verified === true ? String(claims.email) : undefined,
    });
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    // Log the reason only; never codes or tokens.
    console.error("OAuth callback failed:", err instanceof Error ? err.message : "unknown");
    return fail("sign_in_failed");
  }
}
