# ETF Look-Through

Your brokerage app shows a few ETF tickers. This app shows the companies inside them, and how much of your money really sits in each one.

Built on [SnapTrade OAuth](https://docs.snaptrade.com/docs/oauth-apps): you sign in with SnapTrade, approve read-only access, and the app reads your holdings across connected brokerages.

> **Status:** the look-through view is built on top of sign-in and holdings. Hardening comes next.

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

## Fund data

What's inside each ETF comes from the fund providers' holdings files, not from SnapTrade. BlackRock's and State Street's terms don't allow republishing those files, so they aren't in this repo:

- **Without the real data,** `npm run dev`, `build` and `test` write a small made-up sample first (`scripts/fetch_fund_data.mjs`). The app runs, and tests that check real numbers are skipped.
- **On Vercel,** the build downloads the real file from a private repo, using a read-only token in `FUND_DATA_TOKEN`. If the download fails, the build fails, so the live site never shows sample data.
- **To refresh it,** download each fund's holdings file by hand, run `python3 scripts/build_funds.py <folder>`, and upload the new `data/fund-data.ts` to the private repo.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel.
2. Add the same four environment variables, with `APP_URL=https://<your-project>.vercel.app`. Add `FUND_DATA_TOKEN` too, for the real fund data (see above).
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

Every choice I made, why, and what I'd change, grouped by topic, is in [TRADEOFFS.md](TRADEOFFS.md). It starts with the parts of SnapTrade's API the app depends on, and the risk if they change.

## Known limitations

- Fund contents come from the fund providers, not SnapTrade, as a dated snapshot of 8 ETFs. Other ETFs are listed as not looked through.
- Two tabs refreshing at the same moment can sign you out, because refresh tokens rotate and each tab holds its own copy of the cookie. Sign in again to recover.
- Any failed refresh signs you out, including a brief network problem, because it's safer than keeping a token that may be invalid.
- Short positions aren't handled specially: they'd count as negative values.

## API and docs feedback log

Notes for SnapTrade, written as I hit them:

- Connecting Wealthsimple: the "Verifying your identity… Almost there!" screen stayed up with no hint to check the Wealthsimple app or email for an approval, and no timeout or next step.
- Retired positions endpoint: `/accounts/{id}/positions` returns `410 Gone` ("no longer available for your account") for new customers. The 410 is clear, but the message would be more useful if it named the replacement.
- Replacement endpoint: `/accounts/{id}/positions/all` works, and returns `{ results: [...], data_freshness: { as_of } }` rather than a bare list, so moving to it changes the parsing as well as the URL.
- Numbers as strings: `/positions/all` returns values like `"units": "5"` and `"price": "180.5"`, where the old endpoint used numbers. In JavaScript, `+` on two strings joins them instead of adding, so every value has to be converted first. A note in the API reference would help.
- Base URL: the OAuth docs use `https://api.snaptrade.com/...`, not `/api/v1`. My code's default had `/api/v1`, so I changed it to match.
- OAuth guide: it says to test an expired code and refresh-token rotation, but doesn't document what the server returns for an expired code, a reused refresh token or a revoke. In testing, an invalid code returned `400 invalid_grant`. Documenting these errors would let apps handle them on purpose.
- Money market funds: they appear in `/positions/all` and inside `cash` in `/balances`, flagged by `cash_equivalent: true`. The docs do say this, but adding positions and cash is the obvious way to get a total, so it's easy to count them twice. A note in the positions guide would help. Comparing with `balance.total` on `/accounts` is what confirmed it.
- OAuth guide's sample code: it puts the token endpoint's whole response body into a thrown error. The guide also says never to log tokens, so a note about not logging that error would help.
- Balance history (beta): the reference documents `/accounts/{id}/balanceHistory` only with `userId` and `userSecret`, not OAuth. It does work with an OAuth Bearer token (tested 2026-11-05), so saying so in the reference would save apps a test.
- Balance history (beta): the schema says `date` is a date, but the example shows a full timestamp (`2026-01-01T00:00:00.000Z`), so the app accepts both. `total_value` is a string, like positions.
