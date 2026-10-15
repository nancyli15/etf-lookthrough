// Calls the SnapTrade data API with the user's Bearer token.
// Handles: refreshing shortly before expiry, refresh-token rotation, and
// "on 401, refresh once and retry once" from the OAuth guide.
import { API_BASE } from "./config";
import { tokenRequest } from "./oauth";
import { clearSession, getSession, saveSession, type Session } from "./session";

export class NotSignedInError extends Error {}

export type ApiResult = { path: string; status: number; ok: boolean; data: unknown };

async function refreshSession(session: Session): Promise<Session> {
  try {
    const t = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    });
    const next: Session = {
      ...session,
      accessToken: t.access_token,
      // Refresh tokens rotate: the old one is now invalid, so always store the new one.
      refreshToken: t.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + t.expires_in * 1000,
      scope: t.scope ?? session.scope,
    };
    await saveSession(next);
    return next;
  } catch {
    // Refresh failed (revoked, expired, already used): sign out and ask to authorize again.
    await clearSession();
    throw new NotSignedInError("Session expired");
  }
}

// Must be used from Route Handlers (not Server Components) so rotated tokens can be saved.
export async function createClient() {
  let session = await getSession();
  if (!session) throw new NotSignedInError("Not signed in");

  if (Date.now() > session.expiresAt - 60_000) {
    session = await refreshSession(session);
  }

  let refreshed: Promise<Session> | null = null;

  async function get(path: string, query: Record<string, string> = {}): Promise<ApiResult> {
    const url = new URL(API_BASE + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    const call = (s: Session) =>
      fetch(url, {
        headers: { Authorization: `Bearer ${s.accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });

    let res = await call(session!);
    if (res.status === 401 && !refreshed) {
      // Shared promise: concurrent 401s trigger only one refresh.
      refreshed = refreshSession(session!).then((s) => (session = s));
      await refreshed;
      res = await call(session!);
    } else if (res.status === 401 && refreshed) {
      await refreshed;
      res = await call(session!);
    }

    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { path, status: res.status, ok: res.ok, data };
  }

  return { get, getSession: () => session! };
}
