// OAuth 2.0 + OpenID Connect helpers, following docs.snaptrade.com/docs/oauth-apps.
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ISSUER, requireEnv } from "./config";

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

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Discovery failed: ${res.status} ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

// Endpoints are discovered, not hard-coded. Cached per server instance.
let metadataPromise: Promise<Metadata> | null = null;
export function getMetadata(): Promise<Metadata> {
  if (!metadataPromise) {
    metadataPromise = Promise.all([
      fetchJson(`${ISSUER}/.well-known/openid-configuration`),
      fetchJson(`${ISSUER}/.well-known/oauth-authorization-server`),
    ])
      .then(([oidc, oauth]) => ({ ...oauth, ...oidc }) as unknown as Metadata)
      .catch((err) => {
        metadataPromise = null; // retry on the next request
        throw err;
      });
  }
  return metadataPromise;
}

// Created once, caches SnapTrade's public signing keys and refetches on an unknown key id.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
async function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL((await getMetadata()).jwks_uri));
  return jwks;
}

export function randomToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// PKCE: SHA-256 of the verifier, base64url without padding.
export function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function clientAuthHeader(): string {
  const id = requireEnv("SNAPTRADE_CLIENT_ID");
  const secret = requireEnv("SNAPTRADE_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

// Used for both the code exchange and refreshes. Never logs token values.
export async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { token_endpoint } = await getMetadata();
  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: clientAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  if (!res.ok) {
    let code = "unknown_error";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {}
    throw new Error(`Token request failed: ${res.status} ${code}`);
  }
  return (await res.json()) as TokenResponse;
}

// Verifies signature (RS256 via JWKS), issuer, audience, expiry, age, and nonce.
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

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const { revocation_endpoint } = await getMetadata();
  if (!revocation_endpoint) return false;
  const res = await fetch(revocation_endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: clientAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token" }),
    cache: "no-store",
  });
  return res.ok;
}
