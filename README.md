# ETF Look-Through

Your brokerage app shows a few ETF tickers. This app shows the companies inside them, and how much of your money really sits in each one.

Built on [SnapTrade OAuth](https://docs.snaptrade.com/docs/oauth-apps): you sign in with SnapTrade, approve read-only access, and the app reads your holdings across connected brokerages.

> **Status:** Step 0, sign-in plus raw data. The look-through view comes next.

## Run it locally

Requires Node.js 20 or newer.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in:
   - `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CLIENT_SECRET`: from **SnapTrade Dashboard → OAuth Apps**, not API Keys
   - `SESSION_SECRET`: run `openssl rand -base64 32`
   - `APP_URL=http://localhost:3000`
3. In OAuth Apps, register the redirect URI `http://localhost:3000/oauth/snaptrade/callback`.
4. `npm run dev`, then open http://localhost:3000.

`.env.local` is git-ignored. Never commit secrets.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel.
2. Add the same four environment variables, with `APP_URL=https://<your-project>.vercel.app`.
3. Add `https://<your-project>.vercel.app/oauth/snaptrade/callback` as a redirect URI in OAuth Apps.
4. Redeploy.

## How sign-in works

1. `/login` creates a fresh `state`, `nonce` and PKCE `code_verifier`, stores them in a short-lived encrypted cookie, and redirects to SnapTrade's consent screen.
2. SnapTrade redirects to `/oauth/snaptrade/callback`. The app:
   - rejects a missing or mismatched `state`
   - exchanges the code on the server with the client secret
   - verifies the `id_token`: RS256 signature against SnapTrade's JWKS, `iss`, `aud`, `exp`, `iat` age, and `nonce`
3. Tokens are stored in an encrypted, httpOnly cookie. Data calls send only `Authorization: Bearer <access_token>`.
4. Tokens refresh a minute before expiry. Refresh tokens rotate, so the new one is always saved. On a 401, the app refreshes once and retries once.
5. **Disconnect** revokes the refresh token at SnapTrade and deletes local tokens.

## Decisions and tradeoffs

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Scopes `openid email read` only | No trading, no notifications needed. Asking for less builds trust. | Add `webhook` if holdings should update in the background |
| Tokens in an encrypted cookie, no database | Fewer moving parts for v1; nothing stored server-side | Encrypted database row keyed on the id_token `sub` |
| API calls only in Route Handlers | Server Components can't set cookies, so rotated refresh tokens would be lost | — |
| Email kept only if `email_verified` | Per SnapTrade guidance | — |
| Raw-data download | Look at real API responses before designing the UI | Remove or hide behind a debug flag |

## Known limitations

- Fund contents (what's inside each ETF) come from the fund providers, not SnapTrade. The look-through will support a fixed list of popular ETFs, with a dated snapshot.

## API and docs feedback log

Notes for SnapTrade, written as I hit them:

- Connecting Wealthsimple: the "Verifying your identity… Almost there!" screen stayed up with no hint to check the Wealthsimple app or email for an approval, and no timeout or next step.
