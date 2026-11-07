// Step 1 of sign-in: create fresh state, nonce and PKCE values, then send the
// browser to SnapTrade's consent screen.
import { NextResponse, type NextRequest } from "next/server";
import { SCOPES, requireEnv, redirectUri } from "@/lib/snaptrade/config";
import { codeChallenge, getMetadata, randomToken } from "@/lib/snaptrade/oauth";
import { setLoginState } from "@/lib/snaptrade/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const snapTradeOAuthMetadata = await getMetadata();

    // Lets the callback confirm that the response belongs to this login attempt.
    const loginState = randomToken(32);
    // Ties the identity token (id_token) to this login attempt.
    const loginNonce = randomToken(32);
    // PKCE: SnapTrade gets a challenge derived from this secret now, and our
    // backend proves it holds the secret when exchanging the authorization code.
    const pkceCodeVerifier = randomToken(64);

    // Saved so the callback can check them when SnapTrade sends the user back.
    await setLoginState({
      state: loginState,
      nonce: loginNonce,
      codeVerifier: pkceCodeVerifier,
    });

    const snapTradeAuthorizationUrl = new URL(snapTradeOAuthMetadata.authorization_endpoint);
    const params = snapTradeAuthorizationUrl.searchParams;
    params.set("response_type", "code");
    params.set("client_id", requireEnv("SNAPTRADE_CLIENT_ID"));
    params.set("redirect_uri", redirectUri());
    params.set("scope", SCOPES);
    params.set("state", loginState);
    params.set("nonce", loginNonce);
    params.set("code_challenge", codeChallenge(pkceCodeVerifier));
    params.set("code_challenge_method", "S256");

    return NextResponse.redirect(snapTradeAuthorizationUrl);
  } catch (err) {
    // SnapTrade unreachable or a setting missing: a message beats a crash page.
    console.error("Starting sign-in failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.redirect(new URL("/?error=sign_in_unavailable", req.url));
  }
}
