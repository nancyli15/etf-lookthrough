# ETF Look-Through

Your brokerage app shows a few ETF tickers. This app shows the companies inside them, and how much of your money really sits in each one. For self-directed DIY investors who hold several ETFs and some stocks, often across accounts (TFSA, FHSA, RRSP, IRA, taxable), and who suspect they're less diversified than they think. Typical case: holding XEQT, XQQ and SPY and assuming three funds means three different things.

Built on [SnapTrade OAuth](https://docs.snaptrade.com/docs/oauth-apps): you sign in with SnapTrade, approve read-only access, and the app reads your holdings across connected brokerages.

**Live:** https://etf-lookthrough.vercel.app

<!-- Screenshot: add docs/screenshot.png and uncomment.
![The dashboard: net worth, account value, and every company you own](docs/screenshot.png)
-->

## What it does

- **Net worth,** from your holdings and cash, checked against SnapTrade's own account totals.
- **Account value over the past year,** from SnapTrade's beta balance history.
- **Every company you own,** directly or inside your funds, in one table. Each row has a bar split into what you bought and what's in your funds, and you can filter, search and page through it.
- **A dropdown per company:**
  - how much more you own than your brokerage shows
  - its weight inside each fund
  - a slider for "if it moves this much"
  - which part you control
  - your recent trades and dividends
- **Your funds:** how much of each the app can trace to companies, and how much your funds overlap.
- **An account picker** when you have more than one account: show all of them combined, one brokerage, one account, or any mix. The title says what's shown, such as "Wealthsimple · TFSA".
- **A Developer view** with every SnapTrade response behind the page, one row per call.

SnapTrade endpoints used: `/accounts`, `/authorizations`, `/accounts/{id}/positions/all`, `/balances`, `/activities` and `/balanceHistory` (beta). All of them are read-only.

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

## How the code is organized

```text
app/             pages and API routes (Next.js uses the folder names as URLs)
  dashboard/     the screen after sign-in: page.tsx and Dashboard.tsx load the data,
    components/  and the pieces of the screen live here
lib/
  snaptrade/     sign-in, encrypted cookies, and calls to SnapTrade's API
  portfolio/     turns SnapTrade's answers into clean holdings, accounts, trades and history
  analysis/      the look-through math, and the report the screen shows
  display/       wording and small helpers for the screen, with no fund data
data/            fund holdings and exchange rates
scripts/         builds and downloads the fund data
```

Each test file sits next to the file it checks, and each component's styles sit next to it (`CompanyTable.tsx` and `CompanyTable.css`). Shared styles are in `app/globals.css`.

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
- Account value history comes from a beta endpoint. Its values are estimates, it covers a year at most, and it counts deposits as growth.
- Recent activity only goes back as far as each brokerage's history, which the dropdown states.
- A portfolio holding XEQT sends about 7,900 companies to the browser (209 KB compressed).

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
- Hidden accounts: accounts marked "Hidden" in SnapTrade make `/accounts` return `200` and `[]`, exactly like having no brokerage shared at all, while `/authorizations` shows the connection as active. Nothing in either response says the accounts are hidden, so it took a while to find. A field or note saying "N accounts hidden" would make this obvious.
