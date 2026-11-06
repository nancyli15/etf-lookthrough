// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested.
//
// One page scroll. On wide screens, each chart sits beside what it explains: net
// worth beside its history, and the company bars beside the breakdown they select.
// On a phone, each pair stacks.
import { Fragment, useState } from "react";
import { FX } from "../../data/fx";
import { displayName, shortName } from "../../lib/names";
import { hasLargeGap, percentText } from "../../lib/format";
import type { Report } from "../../lib/report";
import AccountValueChart from "./AccountValueChart";
import CompanyBreakdown from "./CompanyBreakdown";
import CompanyDetails from "./CompanyDetails";
import CompanyChart from "./CompanyChart";
import ShareButton from "./ShareButton";

const TOP_ROWS = 15;

function formatUnits(units: number): string {
  return units.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function sumOf<T>(rows: T[], valueOf: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + valueOf(row), 0);
}

function formatDate(iso: string): string {
  // Date-only strings are midnight UTC, which can display as the day before locally.
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

export default function LookThrough({ report }: { report: Report }) {
  const [showAllFundCompanies, setShowAllFundCompanies] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // The company shown in the "Where it comes from" card. Starts on the biggest one.
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  // Companies opened inside the combined table. Opening one in place, instead of
  // scrolling to the card, keeps the reader's spot in a long table.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const {
    result,
    headline,
    skipped,
    failedAccounts,
    holdingsAsOf,
    cash,
    cashNotLoaded,
    cashUnconverted,
    netWorth,
    brokerageTotal,
    differsFromBrokerage,
  } = report;

  function money(value: number, currency = result.currency): string {
    try {
      return value.toLocaleString(undefined, { style: "currency", currency });
    } catch {
      // A currency code the browser doesn't recognise shouldn't break the page.
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  const companies = showAll ? result.companies : result.companies.slice(0, TOP_ROWS);
  const fundCompanies = result.companies
    .filter((company) => company.throughFunds > 0)
    .sort((first, second) => second.throughFunds - first.throughFunds);
  const visibleFundCompanies = showAllFundCompanies ? fundCompanies : fundCompanies.slice(0, TOP_ROWS);

  // Totals always cover every row, including rows hidden behind "Show all".
  const directTotal = sumOf(result.directHoldings, (holding) => holding.value);
  const namedInFunds = sumOf(fundCompanies, (company) => company.throughFunds);
  const namedTotal = sumOf(result.companies, (company) => company.total);
  const fundsTotal = sumOf(result.funds, (fund) => fund.value);
  const crypto = sumOf(
    result.notLookedThrough.filter((holding) => holding.kind === "crypto"),
    (holding) => holding.value,
  );
  const otherHoldings = sumOf(
    result.notLookedThrough.filter((holding) => holding.kind !== "crypto"),
    (holding) => holding.value,
  );
  const unopened = sumOf(result.insideUnopenedFunds, (fund) => fund.value);
  const cashEquivalentsText = result.cashEquivalents
    .map((holding) => `${money(holding.value)} in ${holding.symbol}`)
    .join(", ");
  const shareOf = (value: number) => percentText(result.total ? value / result.total : 0);
  const fundDates = [...new Set(result.funds.map((fund) => fund.asOf))].map(formatDate).join(", ");
  const selected = result.companies.find((company) => company.key === selectedKey) ?? result.companies[0];

  function toggleOpen(key: string) {
    const next = new Set(openKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenKeys(next);
  }

  return (
    <>
      {failedAccounts.length > 0 && (
        <div className="card error">
          Couldn't load {failedAccounts.join(", ")}, so these totals are missing those holdings.
        </div>
      )}
      {skipped.length > 0 && (
        <div className="card error">
          Left out because SnapTrade didn't return a usable price or quantity: {skipped.join(", ")}.
        </div>
      )}
      {result.unconverted.length > 0 && (
        <div className="card error">
          Left out because we have no exchange rate:{" "}
          {result.unconverted.map((holding) => `${holding.symbol} (${money(holding.value, holding.currency)})`).join(", ")}.
        </div>
      )}

      <div className="pair">
        {netWorth !== 0 && (
          <div className="card net-worth">
            <h2>Your summary</h2>
            <p className="muted small">Total net worth</p>
            <p className="net-worth-value">{money(netWorth)}</p>
            <p className="muted small">Across your connected brokerage accounts only.</p>
            <table>
              <tbody>
                {directTotal !== 0 && (
                  <tr>
                    <td>Stocks you bought directly</td>
                    <td className="num">{money(directTotal)}</td>
                  </tr>
                )}
                {fundsTotal !== 0 && (
                  <tr>
                    <td>Funds</td>
                    <td className="num">{money(fundsTotal)}</td>
                  </tr>
                )}
                {crypto !== 0 && (
                  <tr>
                    <td>Crypto</td>
                    <td className="num">{money(crypto)}</td>
                  </tr>
                )}
                {otherHoldings !== 0 && (
                  <tr>
                    <td>Other holdings</td>
                    <td className="num">{money(otherHoldings)}</td>
                  </tr>
                )}
                <tr>
                  <td>
                    Cash
                    {cashEquivalentsText && cashNotLoaded.length === 0 && (
                      <div className="muted small">Includes {cashEquivalentsText}, a money market fund</div>
                    )}
                  </td>
                  <td className="num">{money(cash)}</td>
                </tr>
              </tbody>
            </table>
            {(failedAccounts.length > 0 ||
              cashNotLoaded.length > 0 ||
              cashUnconverted.length > 0 ||
              result.unconverted.length > 0 ||
              skipped.length > 0) && (
              <p className="error small spaced">
                This total is incomplete.
                {failedAccounts.length > 0 && <> Holdings didn't load for {failedAccounts.join(", ")}.</>}
                {cashNotLoaded.length > 0 && <> Cash didn't load for {cashNotLoaded.join(", ")}.</>}
                {cashUnconverted.length > 0 && <> No exchange rate for cash in {cashUnconverted.join(", ")}.</>}
                {result.unconverted.length > 0 && <> Some holdings have no exchange rate.</>}
                {skipped.length > 0 && <> Some positions couldn't be valued.</>}
              </p>
            )}
            {differsFromBrokerage && brokerageTotal !== undefined && (
              <p className="error small spaced">
                SnapTrade reports {money(brokerageTotal)} for these accounts, so this total may be off by{" "}
                {money(Math.abs(netWorth - brokerageTotal))}.
              </p>
            )}
          </div>
        )}
        {result.total !== 0 && <AccountValueChart currency={result.currency} money={money} />}
      </div>

      <div className="card">
        <p className="headline">{headline?.title ?? "There's nothing to look through in these accounts yet."}</p>
        {headline && <p className="muted">{headline.detail}</p>}
        {hasLargeGap(result) && (
          <p className="error">
            {shareOf(unopened)} of your portfolio sits inside funds we can't open yet (
            {result.insideUnopenedFunds.map((fund) => fund.symbol).join(", ")}), so company totals are likely understated.
          </p>
        )}
        <ShareButton result={result} />
      </div>

      {result.total !== 0 && (
        <div className="pair">
          <CompanyChart
            companies={result.companies}
            selectedKey={selected?.key}
            onSelect={setSelectedKey}
            money={money}
          />
          {selected && <CompanyBreakdown company={selected} money={money} />}
        </div>
      )}

      {result.total !== 0 && <h2 className="section-title">The details</h2>}

      {result.directHoldings.length > 0 && (
        <div className="card">
          <h2>Stocks you bought directly</h2>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Shares</th>
                <th className="num">Value</th>
                <th className="num">% of holdings</th>
              </tr>
            </thead>
            <tbody>
              {result.directHoldings.map((holding, holdingIndex) => (
                <tr key={`${holding.symbol}-${holdingIndex}`}>
                  <td>
                    {shortName(holding.name)} <span className="muted">{holding.symbol}</span>
                  </td>
                  <td className="num">{formatUnits(holding.units)}</td>
                  <td className="num">{money(holding.value)}</td>
                  <td className="num">{shareOf(holding.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total bought directly</td>
                <td />
                <td className="num">{money(directTotal)}</td>
                <td className="num">{shareOf(directTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {result.funds.length > 0 && (
        <div className="card">
          <h2>Companies inside your funds</h2>
          <p className="muted small">What your ETFs and mutual funds hold, shown as the dollars of each company you own through them.</p>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Value</th>
                <th className="num">% of holdings</th>
              </tr>
            </thead>
            <tbody>
              {visibleFundCompanies.map((company) => (
                <tr key={company.key}>
                  <td>
                    {shortName(company.name)} <span className="muted">{company.symbol}</span>
                    <div className="muted small">via {company.viaFunds.join(", ")}</div>
                  </td>
                  <td className="num">{money(company.throughFunds)}</td>
                  <td className="num">{shareOf(company.throughFunds)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="subtotal">
                <td>Named companies</td>
                <td className="num">{money(namedInFunds)}</td>
                <td className="num">{shareOf(namedInFunds)}</td>
              </tr>
              <tr className="subtotal">
                <td>Cash and other non-stock holdings inside funds</td>
                <td className="num">{money(result.otherInFunds)}</td>
                <td className="num">{shareOf(result.otherInFunds)}</td>
              </tr>
              {unopened > 0 && (
                <tr className="subtotal">
                  <td>Inside funds we can't open yet</td>
                  <td className="num">{money(unopened)}</td>
                  <td className="num">{shareOf(unopened)}</td>
                </tr>
              )}
              <tr>
                <td>Total in your funds</td>
                <td className="num">{money(fundsTotal)}</td>
                <td className="num">{shareOf(fundsTotal)}</td>
              </tr>
            </tfoot>
          </table>
          {fundCompanies.length > TOP_ROWS && (
            <button
              className="button secondary spaced"
              type="button"
              onClick={() => setShowAllFundCompanies(!showAllFundCompanies)}
            >
              {showAllFundCompanies ? "Show fewer" : `Show all ${fundCompanies.length}`}
            </button>
          )}
        </div>
      )}

      {result.companies.length > 0 && (
        <div className="card">
          <h2>Both combined, by company</h2>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Direct</th>
                <th className="num">Through funds</th>
                <th className="num">Total</th>
                <th className="num">% of holdings</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const isOpen = openKeys.has(company.key);
                return (
                  <Fragment key={company.key}>
                    <tr className={isOpen ? "selected" : undefined}>
                      <td>
                        <button
                          className="link"
                          type="button"
                          onClick={() => toggleOpen(company.key)}
                          aria-expanded={isOpen}
                        >
                          {shortName(company.name)} <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                        </button>{" "}
                        <span className="muted">{company.symbol}</span>
                        {company.viaFunds.length > 0 && <div className="muted small">via {company.viaFunds.join(", ")}</div>}
                      </td>
                      <td className="num">{company.direct > 0 ? money(company.direct) : "–"}</td>
                      <td className="num">{company.throughFunds > 0 ? money(company.throughFunds) : "–"}</td>
                      <td className="num">{money(company.total)}</td>
                      <td className="num">{percentText(company.percent)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="open-row">
                        <td colSpan={5}>
                          <CompanyDetails
                            company={company}
                            funds={result.funds}
                            holdingsTotal={result.total}
                            activities={report.recentActivity[company.symbol.toUpperCase()] ?? []}
                            activitySince={report.activitySince}
                            activityNotLoaded={report.activityNotLoaded}
                            money={money}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total in named companies</td>
                <td className="num">{money(directTotal)}</td>
                <td className="num">{money(namedInFunds)}</td>
                <td className="num">{money(namedTotal)}</td>
                <td className="num">{shareOf(namedTotal)}</td>
              </tr>
            </tfoot>
          </table>
          {result.companies.length > TOP_ROWS && (
            <button className="button secondary spaced" type="button" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${result.companies.length}`}
            </button>
          )}
        </div>
      )}

      {result.overlaps.length > 0 && (
        <div className="card">
          <h2>Where your funds overlap</h2>
          <table>
            <tbody>
              {result.overlaps.map((overlap) => (
                <tr key={`${overlap.fundA}-${overlap.fundB}`}>
                  <td>
                    {overlap.fundA} and {overlap.fundB}
                    <div className="muted small">
                      {overlap.basis === "same-list"
                        ? "Both track the same index."
                        : overlap.sharedCompanies.length > 0
                          ? `Mostly ${overlap.sharedCompanies.slice(0, 3).map(shortName).join(", ")}.`
                          : "No shared companies."}
                      {overlap.incomplete && " One of these holds a fund we can't open yet, so the real overlap is likely higher."}
                    </div>
                  </td>
                  <td className="num">
                    {overlap.basis === "same-list" ? "About 100%" : percentText(overlap.sharedWeight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.funds.length > 0 && (
        <div className="card">
          <h2>How much of each fund we can see</h2>
          <table>
            <thead>
              <tr>
                <th>Fund</th>
                <th className="num">Value</th>
                <th className="num">Traced to companies</th>
              </tr>
            </thead>
            <tbody>
              {result.funds.map((fund) => (
                <tr key={fund.symbol}>
                  <td>
                    {fund.symbol} <span className="muted">{fund.name}</span>
                    {fund.approximatedBy && (
                      <div className="muted small">Uses {fund.approximatedBy}'s holdings, because both track the same index.</div>
                    )}
                  </td>
                  <td className="num">{money(fund.value)}</td>
                  <td className="num">{percentText(1 - fund.otherWeight - fund.unopenedWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(result.notLookedThrough.length > 0 || result.insideUnopenedFunds.length > 0) && (
        <div className="card">
          <h2>Not looked through</h2>
          <table>
            <tbody>
              {result.notLookedThrough.map((holding, holdingIndex) => (
                <tr key={`${holding.symbol}-${holdingIndex}`}>
                  <td>
                    {holding.symbol}{" "}
                    {/* "USDC USDC" says nothing twice. */}
                    {holding.name.toUpperCase() !== holding.symbol.toUpperCase() && (
                      <span className="muted">{displayName(holding.name)}</span>
                    )}
                    <div className="muted small">{holding.reason}</div>
                  </td>
                  <td className="num">{money(holding.value)}</td>
                </tr>
              ))}
              {result.insideUnopenedFunds.map((fund) => (
                <tr key={fund.symbol}>
                  <td>
                    {fund.symbol} <span className="muted">{displayName(fund.name)}</span>
                    <div className="muted small">Held inside one of your funds. We don't have its contents yet.</div>
                  </td>
                  <td className="num">{money(fund.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small">
        {holdingsAsOf && <>Holdings as of {formatDate(holdingsAsOf)}. </>}
        {fundDates && <>Fund data as of {fundDates}. </>}
        {result.fxAsOf && <>Converted at {FX.cadPerUsd} CAD per USD ({FX.source}, {formatDate(result.fxAsOf)}). </>}
        Percentages are of your holdings, so they don't include cash.
      </p>
    </>
  );
}
