# Decisions and tradeoffs

Each row is a choice I made, why, and what I'd change with more time or users. Grouped by the part of the app it affects.

## Relying on SnapTrade's API

The parts of the API the app depends on, and what happens if they change. SnapTrade's API reference was last checked on 2026-11-05.

| Decision | Why | Risk, and what I'd change |
|---|---|---|
| Read holdings from `/accounts/{id}/positions/all` | The older `/positions` returns `410 Gone` for new customers | The response shape differs (`{ results, data_freshness }`), so parsing reads defensively and an unexpected shape shows as no positions rather than a crash |
| Convert every number from a string | `/positions/all` sends `"units": "5"`, and `+` on strings joins them instead of adding | If a later version sends real numbers, `toNumber` accepts both |
| Compare our net worth with each account's `balance.total` | Brokerages report cash and money market funds differently, and this is how the $3,500 double count was found | Compare per account, to say which one differs |
| Load accounts, then 3 calls per account, one after another | Simple, and gentle on the API. The API reference lists 10 requests per minute per account, shared by positions, balances and history. It applies to Personal users, on the brokerages it has been rolled out to so far | With the chart, each page load uses 4 of the 10, so refreshing often can hit it. Cache results for a minute, and wait for the `Reset` header after a `429` |
| Fund contents come from the fund providers, not SnapTrade | SnapTrade reports what you hold, not what's inside a fund | A dated snapshot goes stale. Refresh the files on a schedule |
| No per-stock price history | SnapTrade doesn't offer price history for a symbol, as far as I found | Add a separate price provider before building price charts |
| Any failed token refresh signs the user out | The OAuth guide doesn't document the error for a reused refresh token or a revoke | Handle specific errors once SnapTrade documents them |
| Account value chart from `/accounts/{id}/balanceHistory` | It's the only account history SnapTrade offers | It's a **beta**: it can change without notice, is off by default (`403` until turned on under Add-ons), covers one year at most, and its values are estimates that can have gaps. Its reference only shows the non-OAuth sign-in (`userId` and `userSecret`), but it worked with an OAuth Bearer token in testing on 2026-11-05, and its latest value matched our net worth. If SnapTrade drops it, only the chart goes |
| Load history from its own route, `/api/history` | If the beta fails or changes, only the chart shows an error and the rest of the page loads | — |
| Start the history call only after `/api/raw` finishes | Refresh tokens can be used once. Two calls refreshing at the same moment would sign the user out | Keep one shared session store on the server, so calls can't race |
| `Dashboard.tsx` loads both routes and shares the history with the chart and the Developer view | One place owns the loading order above, and the Developer view shows the history responses without a second call to SnapTrade | — |
| Chart only the dates every account reports | Adding accounts on a date only some of them report would show a fake drop | Fill short gaps from the nearest day, and label them |
| Leave out $0 days at the start of the history | They're before the account had money, and they stretched the chart to $0 so the first deposit looked like a huge jump. A $0 later on could be real, so it stays | — |
| Break the line after more than 5 days without data | Weekends and holidays are normal, but a straight line across weeks would hide missing data | — |
| Label the chart "Account value", not returns | Deposits and withdrawals move the line too, so a rise isn't a return | Calculate time-weighted returns from activities |
| Convert history in other currencies at today's rate | We have one dated rate, not daily history | Daily exchange rates |

## Sign-in and security

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Scopes `openid email read` only | No trading, no notifications needed. Asking for less builds trust. | Add `webhook` if holdings should update in the background |
| Tokens in an encrypted cookie, no database | Fewer moving parts for v1; nothing stored server-side | Encrypted database row keyed on the id_token `sub` |
| API calls only in Route Handlers | Server Components can't set cookies, so rotated refresh tokens would be lost | — |
| Email kept only if `email_verified` | Per SnapTrade guidance | — |
| Turn off Next's request log | It prints full URLs, and the OAuth callback's URL holds the authorization code. Testing with a fake code caught this | Keep it off, and add structured logs that leave out query strings |
| Developer view: one row per API call with its status, and a download of everything | Checking a number against what SnapTrade sent is how the money market double count was found. A row per call shows which one failed without reading JSON | Hide behind a debug flag for real users, since the download includes account numbers |
| The Developer view includes `/balanceHistory`, matched to each account by ID | It's a beta endpoint, so it's the response most worth checking. `/api/history` now returns the account ID, which `/api/raw` already sends | — |
| With no accounts, also call `/authorizations` and say why: no brokerage shared, a disabled connection, still syncing, or a shape we don't read | SnapTrade answers `/accounts` with 200 and an empty list for all of these, and "No accounts yet" left the user guessing. One extra call, only in this case | — |
| The Developer view counts the page's calls against the per-account limit | 2 + 4 per account, against a limit of 10 a minute where it applies, explains why refreshing three times a minute can fail | Read SnapTrade's rate-limit headers and show what's left |
| "Our calculation" sits in the Developer view, labelled "not from SnapTrade" | Seeing the report next to the raw responses shows how one became the other. It's limited to the first 10 companies, because the full report can hold thousands | — |

## Reading holdings

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Merge a security across accounts only within one currency | Adding CAD and USD values together would give a wrong total | Convert with a dated FX rate first, then merge |
| Skip positions with unusable numbers and list them | Counting a blank price as $0 would quietly understate the portfolio | Show the reason per position, and report it to error tracking |
| Money market funds count as cash, not holdings | SnapTrade reports them as a position and inside the cash balance, so counting both overstated net worth by $3,500 in the Sandbox | — |
| Net worth adds cash from `/balances`, but percentages exclude it | Net worth without cash would be wrong, while company percentages answer "of what I've invested" | — |
| Build net worth from its parts, and warn if it's over 1% from SnapTrade's account totals | The parts explain the number, and the check catches brokerages that behave differently. 1% allows for prices moving between calls | Compare per account, to say which one differs |
| Mixed portfolios report in CAD, at a dated Bank of Canada rate | One rate is simple to check and explain. Other currencies are listed, not guessed | Daily rates and more currencies |

## Look-through math and fund data

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Dated snapshot of every holding in each fund, with cash and futures as "other" | The top 25 covered only 51.7% of SPY, so most of the money couldn't be traced to companies. Every holding traces 99%+ of each fund | Refresh the files on a schedule |
| Identify a company by ticker plus market | The same ticker can be two companies: ROP is Roche in Switzerland and Roper in the US | Match on FIGI through OpenFIGI |
| One short name per company, with a list of spellings capitalization can't work out | SnapTrade and fund files name the same company differently, and identical companies shouldn't look like two | Use a company reference source, matched on FIGI |
| Fund overlap adds the smaller weight of each shared company | A standard measure that's easy to check by hand. With every holding it's the real figure, not a minimum | — |
| FXAIX uses SPY's holdings list | Both track the S&P 500, so the weights should be very close, and the UI can say it's a stand-in | Add Fidelity's own file |
| Use BlackRock's own look-through for XEQT | BlackRock's XEQT spreadsheet lists the companies inside its funds rather than the funds, and it's more complete than opening each fund ourselves | — |
| Read iShares' `_fund.xls` spreadsheet as well as its CSV | The holdings download sometimes comes as an old Excel XML file. Python's standard library can read it, so there's no new dependency | — |
| The fund script refuses to write if any file is missing | A run with a wrong folder name once replaced every fund with nothing. Now it stops, unless `--allow-missing` is passed on purpose | — |
| Keep the fund holdings out of this public repo, in a private one that Vercel downloads at build time | BlackRock's terms forbid reposting their content "for public or commercial purposes" without permission, and State Street's footer forbids reproducing it. The code stays public and the data doesn't | Ask the providers for permission, or use the SEC's public N-PORT filings for US funds |
| A clone without the data gets a small made-up sample, and tests of real numbers skip | Anyone can still run the app and the math tests, without the providers' data | — |
| The Vercel build fails if the download fails | A live site quietly showing sample data would be worse than a failed deploy | — |
| One holding per line in the generated file | 19,000 lines instead of 113,000, and a refresh changes one line per holding | — |
| Store each fund's source URL but don't show it as a link | Credits where the data came from. BlackRock's terms also ask sites not to link to theirs without an agreement | — |
| Calculate the look-through on the server, in `/api/raw`, and send the finished report | Every holding of every fund is 2.6 MB. In the browser that made the page 303 KB; now it's 8 KB, and the math didn't change | Send only the top companies plus totals, since a portfolio with XEQT sends 7,900 companies (209 KB compressed) |

## The screen

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Open with net worth, then the biggest company, then the details | People want the total first, and one clear finding gives the tables a reason to be read | Let the user choose the finding, such as most overlap |
| One "Your companies" table instead of a bar chart, a breakdown card and three tables | All five showed the same per-company numbers. Each row's bar is the old chart (page 1 is your top 10), the line under it replaces the Direct and Through funds columns, and the dropdown replaces the breakdown card. About 9 cards became 5 | — |
| Filter buttons: All, Bought directly, Through funds | They keep the old direct-stocks and fund-contents views without separate tables | — |
| The line under each bar lists only the parts that exist | "$611 via SPY" says what NVIDIA is. A "–" or "$0 you bought" beside it was noise | — |
| Whole dollars under the bar, full amounts in the Total column | The line is for reading at a glance; the exact figure is one column over | — |
| Bars are scaled to your biggest company on every page | A bar on page 3 compares with Microsoft's on page 1, instead of filling the width again | — |
| One "Your funds" card: each fund's coverage, the cash inside funds, and overlap | All three are about funds rather than companies, so they sit together | — |
| Show what the numbers can't see, on the main screen | A confident total that's missing money is worse than an honest gap | Close the gaps with more fund files |
| One page scroll, with net worth beside its history | A sticky chart column needed its own scrollbar, and two scroll areas felt awkward. On a phone the pair stacks | — |
| A company's details open under its row | Scrolling up to a separate card lost the reader's place in a long table. Opening in place keeps it, and several can be open to compare | Click a fund to see its own top companies |
| The dropdown answers five questions instead of repeating the row's dollars: more than your brokerage shows, its weight inside each fund, what if it moves, which part you control, and your recent activity | The row already shows direct and through-fund dollars, so repeating them added nothing | — |
| Facts, not advice: "You control the $1,920 in your own shares", never "consider selling" | A read-only app shouldn't sound like it recommends trades. A test checks the wording | — |
| A slider for the size of a move, 0% to 100%, starting at 10%, with "Up or down, your holdings move about $205.70" | A fall and a rise of the same size move the same dollars, so a −50% to +50% slider showed the same number twice. One direction, labelled "up or down", says it once and keeps the slider to try different sizes | Use real price history, to show how much it has actually moved |
| Long company tables page through 10 at a time, with a search box | 502 companies, or 7,900 with XEQT, made "Show all" a very long scroll, especially with dropdowns open. Search finds one company faster than paging | Sort by any column |
| Table totals still cover every company, not just the page or the search results | A total that changed with the page or a search would look like the money moved | — |
| Weight inside a fund is worked out from dollars: $137.04 of $8,373.75 of SPY is 1.64% | It uses numbers already in the report, so the browser still gets no fund data | — |
| Recent activity shows trades and dividends only, 3 per company, including stock dividends and reinvested ones | Fees and taxes aren't about the company. It's only your own activity: what a fund trades inside itself isn't in `/activities` | Show more, with a "See all" link |
| Every dropdown has an activity section, and with nothing to list it says how far back the history goes | An empty space looks like a bug, while "nothing since Sep 16, 2026" is an answer. The date is each account's `sync_status.transactions.first_transaction_date` | — |
| With several accounts, use the latest start date, and none if any account doesn't say | It's the earliest date every account's history covers, so "since" stays true | Show each account's start separately |
| Gain or loss on your shares isn't shown | SnapTrade sends `cost_basis`, but I haven't confirmed whether it's per share or a total. A wrong gain is worse than none | Confirm in the docs, then add it |
| Plain HTML, CSS and SVG charts, no chart library | Every line can be explained, and the page stays small | A library if charts need zooming or many series |
| Chart colors checked for colorblind separation and contrast, in light and dark mode | Blue and orange stay distinct for the most common kinds of colorblindness, and every chart also has a table | — |
| Share percentages only: no dollar amounts, net worth or account names | People share this with friends and online, and the percentages are the interesting part | A share image, made the same way |
| Share image of the top 5 companies, made in the browser | A picture travels further than text in chats and posts. Drawing it in the browser means holdings never go to a server to make it | — |
| Build the image as an SVG, then convert it to a PNG | The SVG is plain text, so tests can check it has no dollar amounts. Chats and social apps accept PNGs, but often not SVGs | — |
| Share opens a card showing the exact image, with Copy image, Download and Copy as text | You see what you're sharing before it leaves the page, and copying is quicker than saving a file. The system share menu is one more button, only where it works, instead of popping up by itself | — |
| Copied text has no link | Chat apps turn a pasted link into their own preview image, which looked like extra images | Let the user choose to include the link |
| Link preview is one generic image, with no holdings | Anyone can fetch a link's preview, so it must never show a user's data | — |
| One light theme, styled like SnapTrade's dashboard, instead of following the system's dark mode | It feels at home next to SnapTrade's own screens, and one theme is half the colors to check | Add a dark theme back, with its own checked chart colors |

## Tooling

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Override PostCSS instead of moving to Next 16 | Next 15 pins a version with known flaws. The override clears the audit, and the build passes, without a major upgrade | Upgrade Next and remove the override |
