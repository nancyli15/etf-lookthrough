// Two encrypted, httpOnly cookies:
//  - st_login:   short-lived; holds state, nonce and PKCE verifier during sign-in
//  - st_session: holds the user's SnapTrade tokens after sign-in
// Tradeoff: no database for v1. With more users, tokens would move to an
// encrypted database row keyed on the SnapTrade user ID (id_token `sub`).
import { cookies } from "next/headers";
import { seal, unseal } from "../seal/seal";

const LOGIN_COOKIE = "st_login";
const SESSION_COOKIE = "st_session";
const MAX_COOKIE_CHARS = 3800; // browsers cap cookies at ~4 KB

export type LoginState = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
  scope: string;
  userId: string; // SnapTrade Personal user ID from the verified id_token `sub`
  email?: string; // only kept when SnapTrade says it is verified
};

const COOKIE_OPTIONS = {
  httpOnly: true, // JavaScript in the browser can't read it
  secure: process.env.NODE_ENV === "production", // HTTPS-only when deployed
  sameSite: "lax" as const, // sent on the redirect back from SnapTrade
  path: "/",
};

// cookies() is Next.js's access to this request's cookies. Setting one adds it to the response.
export async function setLoginState(login: LoginState): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_COOKIE, seal(login), { ...COOKIE_OPTIONS, maxAge: 10 * 60 }); // 10 minutes to finish signing in.
}

// Reads and deletes the login state so it can only be used once.
export async function takeLoginState(): Promise<LoginState | null> {
  const cookieStore = await cookies();
  const login = unseal<LoginState>(cookieStore.get(LOGIN_COOKIE)?.value);
  cookieStore.delete(LOGIN_COOKIE);
  return login;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return unseal<Session>(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function saveSession(session: Session): Promise<void> {
  const value = seal(session);
  if (value.length > MAX_COOKIE_CHARS) {
    throw new Error("Session too large for a cookie; move tokens to a database.");
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, { ...COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 }); // 30 days.
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
