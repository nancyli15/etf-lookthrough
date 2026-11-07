// OAuth 2.0 + OpenID Connect helpers, following docs.snaptrade.com/docs/oauth-apps.
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ISSUER, requireEnv } from "../config/config";

// SnapTrade's "authorization server metadata": the addresses of its sign-in endpoints.
type Metadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  jwks_uri: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
};

async function fetchDiscoveryDocument(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Discovery failed: ${res.status} ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

// Endpoints are discovered, not hard-coded. Cached per server instance.
let metadataPromise: Promise<Metadata> | null = null;
export function getMetadata(): Promise<Metadata> {
  if (!metadataPromise) {
    metadataPromise = Promise.all([
      fetchDiscoveryDocument(`${ISSUER}/.well-known/openid-configuration`),
      fetchDiscoveryDocument(`${ISSUER}/.well-known/oauth-authorization-server`),
    ])
      .then(([oidc, oauth]) => ({ ...oauth, ...oidc }) as unknown as Metadata)
      .catch((err) => {
        metadataPromise = null; // retry on the next request
        throw err;
      });
  }
  return metadataPromise;
}

// JWKS ("JSON Web Key Set") is SnapTrade's list of public keys for checking id_token
// signatures. jose's createRemoteJWKSet downloads it, caches it, and fetches it again
// if a token names a key it hasn't seen. Created once per server instance.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
async function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL((await getMetadata()).jwks_uri));
  return jwks;
}

export function randomToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// PKCE: SHA-256 of the verifier, base64url without padding (the "S256" method).
export function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// HTTP Basic auth: "Basic " + base64("client_id:client_secret"). This is how our
// server proves it's this app when it talks to SnapTrade's token endpoints.
function clientAuthHeader(): string {
  const id = requireEnv("SNAPTRADE_CLIENT_ID");
  const secret = requireEnv("SNAPTRADE_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

// OAuth token endpoints take form fields (a=1&b=2), not JSON, with the app's credentials.
function postForm(url: string, fields: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: clientAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    cache: "no-store",
  });
}

// Used for both the code exchange and refreshes. Never logs token values.
export async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { token_endpoint } = await getMetadata();
  const res = await postForm(token_endpoint, params);
  if (!res.ok) {
    // OAuth errors have a short code like "invalid_grant". It's safe to log; the body's other fields aren't read.
    let errorCode = "unknown_error";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errorCode = body.error;
    } catch {}
    throw new Error(`Token request failed: ${res.status} ${errorCode}`);
  }
  return (await res.json()) as TokenResponse;
}

// Verifies signature (RS256 via JWKS), issuer, audience, expiry, age, and nonce.
// jose's jwtVerify checks the signature and the standard claims, and throws if any fail.
export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<JWTPayload> {
  const metadata = await getMetadata();
  const { payload } = await jwtVerify(idToken, await getJwks(), {
    issuer: metadata.issuer,
    audience: requireEnv("SNAPTRADE_CLIENT_ID"),
    algorithms: ["RS256"],
    maxTokenAge: "10m", // reject an implausibly old iat
  });
  if (payload.nonce !== expectedNonce) throw new Error("ID token nonce mismatch");
  if (!payload.sub) throw new Error("ID token missing sub");
  return payload;
}

// Tells SnapTrade to cancel the refresh token, so this app can't get new access tokens.
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const { revocation_endpoint } = await getMetadata();
  if (!revocation_endpoint) return false;
  const res = await postForm(revocation_endpoint, { token: refreshToken, token_type_hint: "refresh_token" });
  return res.ok;
}
