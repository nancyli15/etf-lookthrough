// Calls the SnapTrade data API with the user's Bearer token.
// Handles: refreshing shortly before expiry, refresh-token rotation, and
// "on 401, refresh once and retry once" from the OAuth guide.
import { API_BASE } from "../config/config";
import { tokenRequest } from "../oauth/oauth";
import { clearSession, getSession, saveSession, type Session } from "../session/session";

export class NotSignedInError extends Error {}

export type ApiResult = { path: string; status: number; ok: boolean; data: unknown };

// The accounts in a /accounts response that have an ID, with each one as SnapTrade
// sent it (`raw`). Read defensively: it's outside data.
export function accountsIn(result: ApiResult): { id: string; name?: string; raw: unknown }[] {
  const list: { id?: unknown; name?: unknown }[] = Array.isArray(result.data) ? result.data : [];
  return list
    .filter((account) => typeof account?.id === "string" && account.id)
    .map((account) => ({
      id: account.id as string,
      name: typeof account.name === "string" ? account.name : undefined,
      raw: account,
    }));
}

async function refreshSession(session: Session): Promise<Session> {
  try {
    const tokens = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    });
    const updatedSession: Session = {
      ...session,
      accessToken: tokens.access_token,
      // Refresh tokens rotate: the old one is now invalid, so always store the new one.
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ?? session.scope,
    };
    await saveSession(updatedSession);
    return updatedSession;
  } catch {
    // Refresh failed (revoked, expired, already used): sign out and ask to authorize again.
    await clearSession();
    throw new NotSignedInError("Session expired");
  }
}

// Must be used from Route Handlers (not Server Components) so rotated tokens can be saved.
export async function createClient() {
  const savedSession = await getSession();
  if (!savedSession) throw new NotSignedInError("Not signed in");

  // Refresh a minute early, so the token can't expire in the middle of a request.
  let session: Session =
    Date.now() > savedSession.expiresAt - 60_000 ? await refreshSession(savedSession) : savedSession;

  let refreshInProgress: Promise<Session> | null = null;

  async function get(path: string, query: Record<string, string> = {}): Promise<ApiResult> {
    const url = new URL(API_BASE + path);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);

    const callApi = (currentSession: Session) =>
      fetch(url, {
        headers: { Authorization: `Bearer ${currentSession.accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });

    let response = await callApi(session);
    if (response.status === 401) {
      // Shared promise: concurrent 401s trigger only one refresh.
      refreshInProgress ??= refreshSession(session).then((newSession) => (session = newSession));
      await refreshInProgress;
      response = await callApi(session);
      if (response.status === 401) {
        // The OAuth guide's rule: refresh once, retry once, then ask the user to authorize again.
        await clearSession();
        throw new NotSignedInError("Still unauthorized after refreshing");
      }
    }

    // Most responses are JSON. If one isn't, keep the text so the Developer view can show it.
    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { path, status: response.status, ok: response.ok, data };
  }

  return { get, getSession: () => session };
}
