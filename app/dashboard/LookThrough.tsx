// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested.
//
// Top to bottom: net worth beside its history, the biggest-company finding, one
// table of every company, your funds, and what couldn't be looked through.
// One page scroll; on a phone, the top pair stacks.
import { FX } from "../../data/fx";
import { hasLargeGap, percentText } from "../../lib/format";
import type { HistoryLoad } from "../../lib/history";
import { displayName } from "../../lib/names";
import type { Report } from "../../lib/report";
import AccountValueChart from "./AccountValueChart";
import CompanyTable from "./CompanyTable";
import FundsCard from "./FundsCard";
import ShareButton from "./ShareButton";

function sumOf<T>(rows: T[], valueOf: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + valueOf(row), 0);
}

function formatDate(iso: string): string {
  // Date-only strings are midnight UTC, which can display as the day before locally.
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

// history defaults to "loading" so tests and previews can render without it.
export default function LookThrough({ report, history = { state: "loading" } }: { report: Report; history?: HistoryLoad }) {
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

  const directTotal = sumOf(result.directHoldings, (holding) => holding.value);
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
        {result.total !== 0 && <AccountValueChart history={history} currency={result.currency} money={money} />}
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

      <CompanyTable report={report} money={money} />

      <FundsCard result={result} money={money} />

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
