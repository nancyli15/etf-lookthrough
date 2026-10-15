// Step 1 of sign-in: create fresh state, nonce and PKCE values, then send the
// browser to SnapTrade's consent screen.
import { NextResponse } from "next/server";
import { SCOPES, requireEnv, redirectUri } from "@/lib/config";
import { codeChallenge, getMetadata, randomToken } from "@/lib/oauth";
import { setLoginState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const metadata = await getMetadata();

  const state = randomToken(32);
  const nonce = randomToken(32);
  const codeVerifier = randomToken(64);
  await setLoginState({ state, nonce, codeVerifier });

  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requireEnv("SNAPTRADE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url);
}