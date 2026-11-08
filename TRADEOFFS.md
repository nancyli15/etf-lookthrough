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
| No per-company chart in the dropdown | SnapTrade offers account value history but not price history for a stock, as far as I found. "Your Microsoft over time" would also need each fund's holdings on past dates, and there's only one snapshot. Using today's weights for past dates would be quietly wrong | Add a price provider, after checking its terms. Start with the stock's price alone, clearly labelled, then add the shares you bought from `/activities`, and the fund part only once there are dated snapshots |
| Any failed token refresh signs the user out | The OAuth guide doesn't document the error for a reused refresh token or a revoke | Handle specific errors once SnapTrade documents them |
| Account value chart from `/accounts/{id}/balanceHistory` | It's the only account history SnapTrade offers | It's a **beta**: it can change without notice, is off by default (`403` until turned on under Add-ons), covers one year at most, and its values are estimates that can have gaps. Its reference only shows the non-OAuth sign-in (`userId` and `userSecret`), but it worked with an OAuth Bearer token in testing on 2026-11-05, and its latest value matched our net worth. If SnapTrade drops it, only the chart goes |
| Load history from its own route, `/api/history` | If the beta fails or changes, only the chart shows an error and the rest of the page loads | — |
| Start the history call only after `/api/raw` finishes | Refresh tokens can be used once. Two calls refreshing at the same moment would sign the user out | Keep one shared session store on the server, so calls can't race |
| `Dashboard.tsx` loads both routes and shares the history with the chart and the Developer view | One place owns the loading order above, and the Developer view shows the history responses without a second call to SnapTrade | — |
| On a date an account skipped, use its latest value from up to 5 days before | Accounts update on different days. Using only dates every account had ended the Sandbox chart on Nov 2 at $117,994.93, while net worth was $105,625.85. Now it ends on Nov 5 and matches. Past 5 days the date is left out, since adding a missing account as $0 would show a fake drop | Mark carried-forward days on the chart |
| Leave out $0 days at the start of the history | They're before the account had money, and they stretched the chart to $0 so the first deposit looked like a huge jump. A $0 later on could be real, so it stays | — |
| Break the line after more than 5 days without data | Weekends and holidays are normal, but a straight line across weeks would hide missing data | — |
| Label the chart "Account value", not returns | Deposits and withdrawals move the line too, so a rise isn't a return | Calculate time-weighted returns from activities |
| Convert history in other currencies at today's rate | We have one dated rate, not daily history | Daily exchange rates |
| "Holdings synced 10 hours ago" at the bottom of the net worth card, from the oldest `sync_status.holdings.last_successful_sync` | SnapTrade syncs brokerages on a schedule, not live, and this was only in the small print. Not `/positions/all`'s `data_freshness.as_of`: it was the moment SnapTrade answered, 10 hours after the last sync, so it always said "just now". The oldest account is honest for the whole page, and if any account has no time, none is shown | The "ago" doesn't tick while the page stays open. Two endpoints are combined, so `/accounts` and the positions could come from different syncs |
| A red card names any disabled connection, even when other accounts load | `/authorizations` marks a connection `disabled` when its brokerage login stops working. Before, this was only explained when it left no accounts, so with two brokerages and one broken the page looked normal with stale numbers. Says "may be out of date", not "missing", because we haven't seen what `/accounts` returns for a disabled connection | Untested against a real disabled connection: only unit tests cover it. It's shown page-wide, even when the account picker hides that brokerage's accounts |
| An account with `sync_status.holdings.holdings_unavailable` counts at SnapTrade's `balance.total`, in its own net worth row, and stays out of the look-through | SnapTrade's docs say some brokerages (like Vanguard workplace plans) don't share holdings, so empty positions and cash don't mean $0. Before, such an account counted as $0 and set off the "SnapTrade reports…" mismatch warning, which looked like our maths was wrong | Untested against a real one: only unit tests cover it. Company percentages leave it out, so they describe only the accounts we can see inside |

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
| With no accounts, also call `/authorizations` and say why: no brokerage shared, a disabled connection, hidden or still syncing, or a shape we don't read | SnapTrade answers `/accounts` with 200 and an empty list for all of these, and "No accounts yet" left the user guessing. One extra call, only in this case. In practice it was hidden accounts: both Sandbox accounts were marked "Hidden" in SnapTrade | Ask SnapTrade for a field that says accounts are hidden |
| A fund that borrows another's list says so in the dropdown | FXAIX and SPY both showed Microsoft at 6.22%, which looked like a bug. It's because FXAIX uses SPY's list | Add Fidelity's own FXAIX file |
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
| A USD / CAD switch, defaulting to the accounts' own currency | Mixing a USD and a CAD account forces one currency. Letting the user flip it, like light and dark mode, means nobody has to do the conversion in their head. It recalculates through `/api/report`, without calling SnapTrade | Daily rates instead of one dated rate |
| Amounts are always "US$" or "CA$", never a bare "$". The switch alone says "USD / CAD" | Browsers write their own country's dollar as "$", so switching accounts looked like the currency disappeared. "$1,234.56 CAD" was tried and read as cluttered, so the short prefix stayed | — |
| The report currency also looks at cash and account totals, not just holdings | An FHSA with only CA$ cash had no holdings, fell back to USD, and got converted for no reason | — |
| Unticking every account shows "No account chosen", and an account with only cash hides the notes about holdings | An empty page, or notes about fund dates and percentages with nothing to look through, read like a bug | — |
| Say the conversion next to the total, not only in the small print | With the US$105,626 Sandbox and a CAD account, net worth showed CA$154,198, which looked like a calculation error. It was US$105,626 × 1.3978 plus the CAD accounts | Let the user choose the report currency |
| An account picker with checkboxes, everything ticked by default | One sign-in can share several brokerages, and adding them all together mixed test and real money. Checkboxes allow one account, one brokerage, or any mix, and "all" keeps the combined view | — |
| The page title is always "ETF Look-Through". What's shown goes on the summary card: "Wealthsimple · TFSA" | A title that changed with the selection made the header's buttons wrap and jump. A fixed title keeps the header still, and the summary card still names the accounts in SnapTrade's words | — |
| The summary says which accounts it includes | An account with no money, like an empty FHSA, was counted but invisible | — |
| Changing accounts recalculates through `/api/report`, without calling SnapTrade | The browser already has every account's raw data, so it sends back only the ticked ones. Switching often can't hit SnapTrade's rate limit. The math still runs on the server, where the fund data is | — |
| `/authorizations` on every load | The brokerage names for the picker ("SnapTrade Sandbox", not "sandbox") come from it. One call per page, not per account | Cache it, since connections rarely change |

## Look-through math and fund data

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Dated snapshot of every holding in each fund, with cash and futures as "other" | The top 25 covered only 51.7% of SPY, so most of the money couldn't be matched to companies. Every holding matches 99%+ of each fund | Refresh the files on a schedule |
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
| One "Your funds" card: each fund's size, a donut of the funds, and where they overlap | All of it is about funds rather than companies, so it sits together | — |
| How much of a fund is matched to companies is in an ⓘ note per fund, not a column | It's 99%+ for nearly every fund, so a column of 99.9%s was noise. The note gives the exact leftover in dollars (cash, futures, currency) for anyone who wants it | — |
| Overlap as a ranked list of pairs, led by the biggest pair in dollars | A grid made people cross-reference rows and columns, and "39.8%" alone didn't say what it meant. The list reads top to bottom, an ⓘ defines the percentage, and the top line says how much of your money is in that pair. Past six pairs, the rest wait behind "Show all" | A grid again for people with many funds |
| No "duplicated money" figure | "CA$11,694 of your money is in the same companies through both" read like money wasted or counted twice. It isn't: you own separate units of two funds that hold similar companies. The amount in the pair is clearer | — |
| Donuts for the funds card, with every slice labelled with its amount and share | The dataviz guide prefers a segmented bar, because small slices are hard to see in a donut, so every amount is written out in the table beside it | A segmented bar, if small slices turn out hard to read |
| Fund colours avoid blue and orange | Those mean "you bought" and "via funds" on the page, and one colour should mean one thing. Red was dropped from the funds' colours: next to green or pink it failed the colourblind check. Past four funds, the rest fold into "Other" | — |
| One filter button per fund in the company table, and each fund's name in the Funds card links to it | "What's inside SPY?" is the question a look-through answers. A fund's view shows only its companies, sorted by how much you hold through that fund, not by their total | — |
| The summary card keeps its plain rows (stocks, funds, crypto and other, cash). Only two ⓘ notes: the cash inside your funds, on the Funds row, and the money market fund, on the Cash row | A donut of net worth was tried in the summary card and read as busier than the rows. Both notes are about cash, which is easy to confuse, so they're one hover away instead of sentences | — |
| In the Funds card, the table is the donut's legend: each row has its slice's colour | A separate legend listed every fund's amount a second time, right beside the table | — |
| The ⓘ notes are a `<span>` and a `<button>`, not `<details>` like the Accounts dropdown. Both use `useDismiss`, which takes a close function instead of knowing how to close either | A `<details>` isn't allowed inside a paragraph, so the browser breaks the line before it. The note also needs hover, which `<details>` doesn't do | — |
| Show what the numbers can't see, on the main screen | A confident total that's missing money is worse than an honest gap | Close the gaps with more fund files |
| Companies come before funds | What you own through everything is the point of the page. Clicking a fund still filters the company table, and scrolls up to it | — |
| A company's details open under its row | Scrolling up to a separate card lost the reader's place in a long table. Opening in place keeps it, and several can be open to compare | Click a fund to see its own top companies |
| The dropdown answers five questions instead of repeating the row's dollars: more than your brokerage shows, its weight inside each fund, what if it moves, which part you control, and your recent activity | The row already shows direct and through-fund dollars, so repeating them added nothing | — |
| Facts, not advice: "You control the $1,920 in your own shares", never "consider selling" | A read-only app shouldn't sound like it recommends trades. A test checks the wording | — |
| A slider from −50% to +50%, starting at +10%, with a signed result: "+CA$181.98" or "−CA$181.98" | This replaced a 0% to 100% slider labelled "up or down". Feedback found "up or down" vague, and a fall should read as a loss. The −50% to +50% version was tried before and dropped because each number showed twice, but a sign and "gain" or "lose" now make the two sides different | Use real price history, to show how much it has actually moved |
| Long company tables page through 10 at a time, with a search box | 502 companies, or 7,900 with XEQT, made "Show all" a very long scroll, especially with dropdowns open. Search finds one company faster than paging | Sort by any column |
| Table totals still cover every company, not just the page or the search results | A total that changed with the page or a search would look like the money moved | — |
| Weight inside a fund is worked out from dollars: $137.04 of $8,373.75 of SPY is 1.64% | It uses numbers already in the report, so the browser still gets no fund data | — |
| Recent activity shows trades and dividends only, 3 per company, including stock dividends and reinvested ones | Fees and taxes aren't about the company. It's only your own activity: what a fund trades inside itself isn't in `/activities` | Show more, with a "See all" link |
| Headed "Your own trades in Microsoft", and says when the company's fund trades aren't shown | "Recent activity" next to a company you also hold through XQQ looked like it might include the fund's trades | — |
| A buy or sell shows SnapTrade's cash `amount` first, then the price per share | The cash amount is what people recognize as "what I paid", and it can differ from shares × price because of fees or exchange rates | Show fees separately |
| The company dropdown has three sections (how much, which funds, what if) and a bar per fund instead of a paragraph each | Feedback found the old dropdown text-heavy. Bars show which fund adds the most at a glance, and the sentences shrink to one per section. When you hold a company both ways, a small line still names both parts: "+$384 on the shares you bought, +$27 inside SPY" | — |
| The company table's footer is one line, "in companies (N% of your holdings)" | The rest of holdings used to be a long sentence under the table. The summary card's rows already show it, so it isn't repeated | — |
| Every dropdown has an activity section, and with nothing to list it says how far back the history goes | An empty space looks like a bug, while "nothing since Sep 16, 2026" is an answer. The date is each account's `sync_status.transactions.first_transaction_date` | — |
| With several accounts, use the latest start date, and none if any account doesn't say | It's the earliest date every account's history covers, so "since" stays true | Show each account's start separately |
| Gain or loss on your shares isn't shown | SnapTrade sends `cost_basis`, but I haven't confirmed whether it's per share or a total. A wrong gain is worse than none | Confirm in the docs, then add it |
| Plain HTML, CSS and SVG charts, no chart library | Every line can be explained, and the page stays small | A library if charts need zooming or many series |
| Chart colors checked for colorblind separation and contrast, in light and dark mode | Blue and orange stay distinct for the most common kinds of colorblindness, and every chart also has a table | — |
| No share button or share image | The page is the product. Sharing added a dialog, image code and privacy rules to explain, for a feature nobody asked for | Bring it back as percentages only, drawn in the browser |
| Link preview is one generic image, with no holdings | Anyone can fetch a link's preview, so it must never show a user's data | — |
| One light theme, styled like SnapTrade's dashboard, instead of following the system's dark mode | It feels at home next to SnapTrade's own screens, and one theme is half the colors to check | Add a dark theme back, with its own checked chart colors |
| Under the headline, two figures about the biggest company: its total, and how much of it comes through funds. The sentence says "you own 50% more of it than your shares alone" | A top-5 chart was tried, but it repeated the first rows of the company table right below it. The summary says what look-through found; the table shows why | Let the user pick the company |
| The whole company row opens its details, not only the name | A bigger target. The name stays a button, so the keyboard and screen readers still work | — |
| Exact sync time shown beside "10 hours ago", not in a hover tooltip | A `title` tooltip has no visible hint, takes a second to appear, and never appears on a phone. Testing found nobody knew it was there | One more bit of grey text under net worth |
| No worked example on the sign-in page | A card with XEQT, XQQ and SPY's top companies was built and removed: it was twice the size of the sign-in card, repeated what the dashboard shows after sign-in, and was about fund data rather than SnapTrade | First-time users see no result before connecting. A README screenshot covers that for reviewers |
| A fund we have no holdings file for (like VFV) gets its own net worth row, "Funds we can't look inside yet", not "Crypto and other" | Someone holding only VFV saw their whole portfolio labelled "Crypto and other". The kinds that count as funds live in `holdings.ts`, so the browser can use the rule without loading the fund data | Add more funds' files; each one moves money from this row into the company table |

## Tooling

| Decision | Why | What I'd change with more time or users |
|---|---|---|
| Override PostCSS instead of moving to Next 16 | Next 15 pins a version with known flaws. The override clears the audit, and the build passes, without a major upgrade | Upgrade Next and remove the override |
| `lib/` grouped into four folders by job: snaptrade, portfolio, analysis, display | 30 files in one folder made it hard to say where anything lives. Grouping by job gives a one-word answer, like "sign-in is in `lib/snaptrade/`". Tests stay next to their files | — |
| Screen pieces in `app/dashboard/components/`; only `page.tsx` and `Dashboard.tsx` stay above it | The page and the code that loads its data stand out from the 13 pieces they use. Next.js only makes URLs from `page.tsx` and `route.ts`, so the folder never becomes a page | — |
| Each component's styles in a plain `.css` file beside it, not CSS Modules | Same "styles live next to the component" benefit, with no change to any `className`. CSS Modules meant rewriting about 100 of them, and a typo there fails quietly | Move to CSS Modules if class names start clashing. One already did: the table's `td.sources` and the dropdown's `ul.sources`, so the dropdown's became `details-sources` |
| One folder per component, holding its `.tsx`, `.css` and test | Everything about a component is in one place, and adding or deleting one is one folder. Imports read `components/CompanyTable/CompanyTable`, a little repetitive | Add an `index.ts` per folder if the repeated name gets annoying |
| Components import `lib/` and `data/` as `@/lib/...`, not `../../../../lib/...` | The path stays the same wherever a component sits, so moving one can't break it. Imports between nearby components stay relative | — |
| `lib/` modules in folders too, and the three biggest files split: `lookthrough.ts` into identity, flatten and overlap; `LookThrough.tsx` into `NetWorthCard` and `NotLookedThrough`; `DeveloperView.tsx` into `CallRow` and `summaries` | One layout everywhere, and each file answers one question. Folders with one file look a little empty | — |
| A naming and duplication pass over every non-test file, with tests left unchanged | Interview-readiness: each name says what it holds, foreign APIs (Node crypto, jose, SVG dashes, .xlsx internals) have a comment, and one helper replaces each copy (`sumOf`, `listOf`, `toText`, `currencyCodeOf`, `accountsIn`, `postForm`, `errorResponse`). Leaving tests alone proves behaviour didn't change | — |
| SnapTrade's responses have types in `lib/snaptrade/responses`, with every field `unknown` | `any` let code read a field without checking it. With `unknown`, the compiler refuses until `toText`, `toNumber` or `currencyCodeOf` has checked it, which matches how much outside data can be trusted. Only the fields the app reads are listed | Generate types from SnapTrade's OpenAPI spec, and keep `unknown` at the edges |
| A fund's non-company part is `nonCompanyWeight`, not `other` | "other" didn't say other *than what*. It's cash, futures and currency contracts: everything that isn't a company. The key changed in the generated fund file too, so the private data repo needs the new file | — |
