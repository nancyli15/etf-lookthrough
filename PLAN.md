# ETF Look-Through: Project Plan and Handoff

Last updated: 2026-10-15

## 1. Context

**The application:** SnapTrade's Product Engineer role asks applicants to build a small app using **SnapTrade OAuth**, host it publicly, then submit it at careers.snaptrade.com. The app is the starting point for a deep-dive interview about choices, tradeoffs and code.

**What reviewers look for**, from the posting:

- how you **choose a problem**
- how you **shape the experience**
- how you **make sure it works**
- **sensible scope**, and being able to **explain tradeoffs**
- AI tools are welcome, but you must be able to stand behind the code
- they welcome **feedback on their API and developer experience**

**The problem we chose:** "My brokerage app shows a few ETF tickers, but I don't know what I actually own."

- The user holds GOOGL, XQQ (Nasdaq-100, CAD-hedged) and XEQT (a global all-equity fund that holds four other ETFs) in a Wealthsimple TFSA, with automatic buys.
- Google appears directly *and* inside both ETFs. So do Apple, Microsoft and Nvidia, through XQQ and XEQT.
- The app "looks through" ETFs to show the **true exposure** to each company, plus the overlap between funds.

**Why it fits SnapTrade:**

- It uses real holdings across any brokerage, through one sign-in.
- It's useful to any SnapTrade Personal user who holds ETFs.
- SnapTrade says good OAuth apps may be featured to Personal users.

## 2. Current status

**Stage: foundation complete.** The app runs locally and is live at https://etf-lookthrough.vercel.app.

Done:

- [x] SnapTrade Commercial workspace ("CatNan"), Test environment
- [x] Test OAuth app with redirect URIs for localhost and Vercel
- [x] SnapTrade Personal workspace with the **Sandbox** brokerage connected
  - Wealthsimple connection stalled on "Verifying your identity…"; retry later
- [x] Next.js app: sign in with SnapTrade (PKCE + state + nonce, id_token verified), encrypted cookie session, token refresh with rotation, disconnect (revoke)
- [x] Dashboard listing each account's positions, plus a raw-JSON download
- [x] GitHub repo `nancyli15/etf-lookthrough` (public)
- [x] Deployed on Vercel (Hobby), with environment variables set

### File map

| File | What it does |
|---|---|
| `app/login/route.ts` | Starts sign-in: creates state/nonce/PKCE, stores them in a short-lived encrypted cookie, redirects to SnapTrade |
| `app/oauth/snaptrade/callback/route.ts` | Checks state, exchanges the code on the server, verifies the id_token, saves tokens |
| `app/api/raw/route.ts` | Fetches accounts, then each account's positions, balances and activities |
| `app/api/disconnect/route.ts` | Revokes the refresh token, clears the cookie |
| `app/dashboard/Dashboard.tsx` | Client page that shows the holdings tables |
| `lib/oauth.ts` | Discovery, PKCE, token requests, id_token verification (`jose`), revoke |
| `lib/snaptrade.ts` | API client: Bearer token, refresh before expiry, on 401 refresh once and retry once |
| `lib/session.ts`, `lib/seal.ts` | Encrypted httpOnly cookies (AES-256-GCM) |
| `lib/config.ts` | Environment variables, scopes, API base URL |

### Environment variables

These live in `.env.local` locally and in Vercel settings when deployed. Never commit them.

- `SNAPTRADE_CLIENT_ID` and `SNAPTRADE_CLIENT_SECRET`: from the OAuth Apps page, not the API Keys page
- `SESSION_SECRET`
- `APP_URL`: `http://localhost:3000` locally, `https://etf-lookthrough.vercel.app` on Vercel
- `SNAPTRADE_API_BASE`: `https://api.snaptrade.com`

## 3. What we learned from the real API

These are good deep-dive material.

**1. The classic positions endpoint is retired.** `/accounts/{id}/positions` returns **410 Gone** ("no longer available for your account") for new customers. Use `/accounts/{id}/positions/all`, which returns `{ results: [...], data_freshness: { as_of } }`.

**2. Use the base URL from the docs.** The OAuth docs use `https://api.snaptrade.com/...`, not `/api/v1`.

**3. `/positions/all` returns numbers as strings.** For example `"units": "5"` and `"price": "180.5"`. The old endpoint used numbers.

**4. Position shape:**

```
{ instrument: { kind, symbol, raw_symbol, description, currency, exchange,
                figi_instrument: { figi_code, figi_share_class } },
  units, price, cost_basis, currency }
```

- `kind` is one of `stock | etf | mutualfund | crypto | option | ...`. This is how we decide what to look inside.
- `figi_code` is a stable security ID. Crypto has none.

**5. Activities include deposits and buys.** `CONTRIBUTION` is a deposit and `BUY` is a purchase, with units and price. Responses are paginated (`limit: 1000`).

**6. What the Sandbox holds:**

| Account | Holdings |
|---|---|
| IRA | NVDA, GOOGL, **FXAIX** (S&P 500 index mutual fund), SPAXX (money market) |
| Individual | AAPL, MSFT, TSLA, **SPY** (S&P 500 ETF), BTC, ETH, SOL, USDC |

This is a good demo: AAPL, MSFT, NVDA, GOOGL and TSLA are held directly *and* inside SPY and FXAIX.

## 4. Plans

### 4a. The 3-hour plan

| Block | Task | Status |
|---|---|---|
| 0:00–0:30 | Setup: SnapTrade, Sandbox, OAuth app, GitHub, Vercel | Done |
| 0:30–1:15 | Sign-in skeleton, deployed | Done |
| 1:15–2:15 | **Look-through feature** | **Next** |
| 2:15–2:45 | Hardening: tests for the math, empty and error states, edge cases | To do |
| 2:45–3:00 | README polish, demo, submit | To do |

**Shortcuts we took on purpose, and how to explain them:**

- **No database.** Tokens are in an encrypted cookie. With more users, they'd go in an encrypted database row keyed on the id_token `sub`.
- **ETF contents from a dated snapshot** of the top holdings, not a live feed.

### 4b. The full plan (after submitting, before the deep dive)

1. **Step 0: look at raw data first.** Done.
2. **One-page design doc:** problem, user, non-goals, success criteria. Can live in the README.
3. **Prove the math in a Python notebook** (pandas) using real fund holdings CSVs, before trusting the app.
4. Walking skeleton deployed early. Done.
5. Build the feature.
6. **Harden it:**
   - tests (Vitest)
   - validate API responses (Zod)
   - error tracking (Sentry, free tier)
   - light usage analytics (Vercel Analytics)
7. **Polish:** README, a 2-minute demo video, the API feedback notes, and 1–2 friends trying it while you watch.
8. Apply.

**Independent checks that the numbers are right:**

- **iShares' published breakdowns:** a portfolio that is 100% XEQT should match the sector and country split iShares publishes, within about 1%.
- **The brokerage app:** total value should match Wealthsimple's.
- **Morningstar:** compare overlap and top holdings against its fund pages or Portfolio X-ray.
- **SnapTrade's own checklist:** run the "Test Locally" list in the OAuth guide (denied consent, mismatched state, expired code, refresh rotation, revoke).
- **Lighthouse** (built into Chrome) for speed and accessibility.

## 5. Next: the look-through feature, step by step

### Step 1: Housekeeping (about 10 min)

- [ ] Change the default `API_BASE` in `lib/config.ts` to `https://api.snaptrade.com`.
- [ ] Make sure `num()` in `Dashboard.tsx` converts strings to numbers. Already patched by hand.
- [ ] Add the API surprises from section 3 to the README feedback log.
- [ ] Run `npm run build` locally, then commit and push.

### Step 2: Turn API data into clean holdings (about 15 min)

Create `lib/holdings.ts` that turns `/positions/all` results into:

```ts
type Holding = {
  symbol: string;
  name: string;
  kind: string;
  figi?: string;
  units: number;
  price: number;
  currency: string;
  value: number; // units × price
};
```

- Merge the same security across accounts.
- Keep cash and crypto, but mark them "not looked through."

### Step 3: Fund contents snapshot (about 20 min)

Create `data/funds.ts` with the top holdings (for example, the top 25 plus an "Other" bucket) for:

| Fund | Holdings source | Notes |
|---|---|---|
| SPY and FXAIX | SPDR holdings file (ssga.com) | Both track the S&P 500, so they can share one constituent list |
| XQQ | iShares Canada holdings CSV | Nasdaq-100, CAD-hedged |
| XEQT | iShares Canada holdings CSV | **A fund of funds.** It holds ITOT (US, on the US iShares site), XIC (Canada), XEF (developed international) and XEC (emerging markets). Look through two levels. |

- Record an **`asOf` date** for each fund, and show it in the UI.
- **Identifiers:** SnapTrade gives FIGI. Fund files give ticker, ISIN or CUSIP. For v1, match on ticker plus exchange.
  - Watch for **GOOGL and GOOG**: two share classes of one company, and both are in the Nasdaq-100. Group them as "Alphabet."
  - Later, map ISIN to FIGI with the free OpenFIGI API.

### Step 4: The math (about 15 min, plus tests)

Create `lib/lookthrough.ts`. For each company:

> exposure = value held directly + Σ (value of each fund × the company's weight in that fund)

- Apply it recursively for funds that hold other funds, like XEQT.
- Return the top companies by exposure and their % of the total portfolio, plus the overlap between each pair of funds.
- **Write unit tests with hand-computed examples first.** For example: $1,000 of SPY where AAPL is 7% of SPY, plus $500 of AAPL held directly, gives $570 of Apple exposure.
- **Currency:** the user's real account mixes CAD (XEQT, XQQ) and USD (GOOGL). Convert to one currency using a dated FX rate, and say so in the UI. Sandbox is all USD.

### Step 5: The look-through screen (about 20 min)

1. A headline, for example: "You own Apple directly *and* through 2 funds: X% of your portfolio."
2. A top-companies table: direct, through funds, and total, with % of portfolio.
3. A fund overlap section, for example "SPY and FXAIX overlap by about 100%" (both are S&P 500).
4. A "Not looked through" list: crypto, the money market fund, unknown ETFs, each with a clear reason.
5. Footer: "Holdings as of {data_freshness.as_of} · Fund data as of {asOf}."

Keep the raw-JSON view, but move it behind a "Developer view" toggle.

### Step 6: Hardening (about 30 min)

- Empty states: no accounts, or no funds.
- An unknown ETF shows "not supported yet" instead of crashing.
- Run the OAuth guide's test checklist.
- Run `npm run build`, push, and test on the live URL in an Incognito window.

### Step 7: Submit

1. README: problem, screenshot, how it works, decisions and tradeoffs, limitations, feedback log.
2. Apply at careers.snaptrade.com: sign in, select the project, add LinkedIn or résumé.

## 6. Deep-dive prep (do before the interview)

Be ready to explain, in your own words:

- **The OAuth flow**, and why each piece exists: state stops another site from completing a login in your name, PKCE stops a stolen code from being used, the nonce ties the id_token to this login, and the client secret stays on the server.
- **Why tokens are in an encrypted httpOnly cookie**, and what you'd change at scale.
- **Why API calls happen in Route Handlers:** Server Components can't set cookies, and refresh tokens rotate, so the new one has to be saved.
- **The 410 story,** the base-URL story and the strings-for-numbers story. What you'd tell SnapTrade about each.
- **The look-through math,** and its limits: snapshot data, top-N holdings only, FX conversion, share classes.
- **Scope choices:** why `openid email read` only, with no `trade` and no `webhook`.
- **What you'd build next**, for example:
  - live fund data
  - FIGI matching through OpenFIGI
  - sector and country breakdowns
  - the TFSA contribution-room tracker idea, using `CONTRIBUTION` activities
