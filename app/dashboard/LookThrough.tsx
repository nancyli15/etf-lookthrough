// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested.
//
// Top to bottom: the summary (net worth, split into stocks, funds, crypto and cash)
// beside the account value chart, the biggest-company finding, every company, your
// funds and their overlap, and what couldn't be looked through. Clicking a fund's name
// shows its companies in the table above it. One page scroll; on a phone, the top pair stacks.
import { useState } from "react";
import { FX } from "../../data/fx";
import { formatMoney, hasLargeGap, percentText } from "../../lib/format";
import type { HistoryLoad } from "../../lib/history";
import { displayName } from "../../lib/names";
import { fundView, type CompanyView } from "../../lib/paging";
import type { Report } from "../../lib/report";
import AccountValueChart from "./AccountValueChart";
import CompanyTable from "./CompanyTable";
import FundsCard from "./FundsCard";
import InfoPopover from "./InfoPopover";
import BiggestCompany from "./BiggestCompany";

function sumOf<T>(rows: T[], valueOf: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + valueOf(row), 0);
}

function formatDate(iso: string): string {
  // Date-only strings are midnight UTC, which can display as the day before locally.
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

type Props = {
  report: Report;
  history?: HistoryLoad; // Defaults to "loading" so tests and previews can render without it.
  includes?: string; // "Includes all 4 accounts: …", when there's more than one account.
  title?: string; // The summary's heading: what's shown, like "Wealthsimple · TFSA".
};

export default function LookThrough({ report, history = { state: "loading" }, includes, title }: Props) {
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

  // Always "US$" or "CA$" (see formatMoney), so switching accounts never hides which currency it is.
  function money(value: number, currency = result.currency): string {
    return formatMoney(value, currency);
  }

  // The company table's filter. Kept here so clicking a fund in the Funds card can set it.
  const [view, setView] = useState<CompanyView>("all");
  function showFund(symbol: string) {
    setView(fundView(symbol));
    document.getElementById("companies")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const directTotal = sumOf(result.directHoldings, (holding) => holding.value);
  const fundsTotal = sumOf(result.funds, (fund) => fund.value);
  // Crypto and anything else with no companies inside, in one row.
  const notLookedTotal = sumOf(result.notLookedThrough, (holding) => holding.value);
  const unopened = sumOf(result.insideUnopenedFunds, (fund) => fund.value);
  // The part of your funds that isn't companies: cash, futures and currency lines, plus funds we can't open.
  const cashInsideFunds = result.otherInFunds + unopened;
  const cashEquivalentsText = result.cashEquivalents
    .map((holding) => `${money(holding.value)} in ${holding.symbol}`)
    .join(", ");
  const shareOf = (value: number) => percentText(result.total ? value / result.total : 0);
  const fundDates = [...new Set(result.funds.map((fund) => fund.asOf))].map(formatDate).join(", ");

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
            <h2>{title ?? "Your summary"}</h2>
            <p className="muted small">Total net worth</p>
            <p className="net-worth-value">{money(netWorth)}</p>
            <p className="muted small">
              {includes ?? "Across your connected brokerage accounts only."}
              {/* Mixing a USD and a CAD account converts one into the other. Said up here,
                  not only in the small print, because otherwise the total looks wrong. */}
              {result.fxAsOf && (
                <>
                  {" "}
                  {result.currency === "CAD" ? "US$" : "CA$"} amounts are converted to{" "}
                  {result.currency === "CAD" ? "CA$" : "US$"} at {FX.cadPerUsd} CAD per USD ({formatDate(result.fxAsOf)}).
                </>
              )}
            </p>
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
                    <td>
                      Funds
                      {cashInsideFunds > 0 && (
                        <>
                          {" "}
                          <InfoPopover label="About the cash inside your funds">
                            Includes {money(cashInsideFunds)} of cash inside your funds: the cash, futures and currency
                            contracts they hold
                            {unopened > 0 && ", and funds inside them we can't open yet"}.
                          </InfoPopover>
                        </>
                      )}
                    </td>
                    <td className="num">{money(fundsTotal)}</td>
                  </tr>
                )}
                {notLookedTotal !== 0 && (
                  <tr>
                    <td>Crypto and other</td>
                    <td className="num">{money(notLookedTotal)}</td>
                  </tr>
                )}
                <tr>
                  <td>
                    Cash
                    {cashEquivalentsText && cashNotLoaded.length === 0 && (
                      <>
                        {" "}
                        <InfoPopover label="About the cash in your accounts">
                          Includes {cashEquivalentsText}, a money market fund.
                        </InfoPopover>
                      </>
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
        {result.total !== 0 && <AccountValueChart history={history} currency={result.currency} money={money} />}
      </div>

      <div className="card">
        <p className="headline">{headline?.title ?? "There's nothing to look through in these accounts yet."}</p>
        {headline && <p className="muted">{headline.detail}</p>}
        <BiggestCompany company={result.companies[0]} money={money} />
        {hasLargeGap(result) && (
          <p className="error">
            {shareOf(unopened)} of your portfolio sits inside funds we can't open yet (
            {result.insideUnopenedFunds.map((fund) => fund.symbol).join(", ")}), so company totals are likely understated.
          </p>
        )}
      </div>

      {/* Companies first: what you own through everything is the point of the page.
          Your funds come after, and clicking one jumps back up to its companies. */}
      <CompanyTable report={report} money={money} view={view} onViewChange={setView} />

      <FundsCard result={result} money={money} onFundClick={showFund} />

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

      {/* Only with something to look through: for an account with just cash, like an
          empty FHSA, notes about holdings, fund dates and percentages are noise. */}
      {result.total !== 0 && (
        <p className="muted small">
          {holdingsAsOf && <>Holdings as of {formatDate(holdingsAsOf)}. </>}
          {fundDates && <>Fund data as of {fundDates}. </>}
          {result.fxAsOf && <>Converted at {FX.cadPerUsd} CAD per USD ({FX.source}, {formatDate(result.fxAsOf)}). </>}
          Percentages are of your holdings, so they don't include cash.
        </p>
      )}
    </>
  );
}
