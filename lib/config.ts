// Central place for configuration. Secrets only ever come from environment
// variables, which live on the server (Vercel settings or .env.local).

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const ISSUER = "https://api.snaptrade.com";

// Base URL for SnapTrade's data API. Overridable so we can adjust without code changes.
export const API_BASE =
  process.env.SNAPTRADE_API_BASE ?? "https://api.snaptrade.com/api/v1";

// Only what the app actually uses: sign-in (openid), email, and read-only data.
// No `trade` (we never place orders) and no `webhook` (data refreshes on page load).
export const SCOPES = "openid email read";

export function appUrl(): string {
  return requireEnv("APP_URL").replace(/\/$/, "");
}

// Must match a redirect URI registered in the SnapTrade Dashboard exactly.
export function redirectUri(): string {
  return `${appUrl()}/oauth/snaptrade/callback`;
}
