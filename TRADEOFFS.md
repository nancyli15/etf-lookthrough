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
| Chart only the dates every account reports | Adding accounts on a date only some of them report would show a fake drop | Fill short gaps from the nearest day, and label them |
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
| Calculate the look-through on the server, in `/api/raw`, and send the finished report | Every holding of every fund is 2.6 MB. In the browser that made the page 303 KB; now it's 8 KB, and the math didn't change | Send only the top companies plus totals, since a portfolio with XEQT sends 7,900 companies (209 KB compressed) |

## The screen

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Open with net worth, then the biggest company, then the details | People want the total first, and one clear finding gives the tables a reason to be read | Let the user choose the finding, such as most overlap |
| Separate tables for direct stocks, fund contents and both combined | Showing where each dollar comes from is easier to follow than one table with a blank column | Show each fund's amount per company |
| Show what the numbers can't see, on the main screen | A confident total that's missing money is worse than an honest gap | Close the gaps with more fund files |
| Charts in pairs beside what they explain, in one page scroll | A sticky chart column needed its own scrollbar, and two scroll areas felt awkward. Net worth now sits beside its history, and the company bars beside the breakdown they select. On a phone each pair stacks | — |
| A bar chart of the 10 biggest companies, split into direct and through funds | The page's main question is "how much of each company do I own, and how?" Ten bars stay readable | — |
| Clicking a company shows where its money comes from, fund by fund | Answers "why is Apple so big?" without reading three tables | Click a fund to see its own top companies |
| In the combined table, a company's breakdown opens under its row | Scrolling up to the chart's card lost the reader's place in a long table. Opening in place keeps it, and several can be open to compare | Click a fund to see its own top companies |
| Plain HTML, CSS and SVG charts, no chart library | Every line can be explained, and the page stays small | A library if charts need zooming or many series |
| Chart colors checked for colorblind separation and contrast, in light and dark mode | Blue and orange stay distinct for the most common kinds of colorblindness, and every chart also has a table | — |
| Share percentages only: no dollar amounts, net worth or account names | People share this with friends and online, and the percentages are the interesting part | A share image, made the same way |
| The phone's share menu when there is one, otherwise copy to clipboard | Desktop browsers mostly don't have a share menu | — |
| One light theme, styled like SnapTrade's dashboard, instead of following the system's dark mode | It feels at home next to SnapTrade's own screens, and one theme is half the colors to check | Add a dark theme back, with its own checked chart colors |

## Tooling

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Override PostCSS instead of moving to Next 16 | Next 15 pins a version with known flaws. The override clears the audit, and the build passes, without a major upgrade | Upgrade Next and remove the override |
