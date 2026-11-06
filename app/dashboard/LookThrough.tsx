// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested.
//
// Top to bottom: the summary (net worth and one donut of where it all is) beside the
// account value chart, the biggest-company finding, your funds and their overlap,
// every company, and what couldn't be looked through. Clicking a fund's name shows
// its companies in the table below it. One page scroll; on a phone, the top pair stacks.
import { useState } from "react";
import { FX } from "../../data/fx";
import { netWorthBreakdown } from "../../lib/breakdown";
import { formatMoney, hasLargeGap, percentText } from "../../lib/format";
import type { HistoryLoad } from "../../lib/history";
import { displayName } from "../../lib/names";
import { fundView, type CompanyView } from "../../lib/paging";
import type { Report } from "../../lib/report";
import AccountValueChart from "./AccountValueChart";
import CompanyTable from "./CompanyTable";
import FundsCard from "./FundsCard";
import Donut, { type DonutSlice } from "./Donut";
import InfoPopover from "./InfoPopover";
import ShareButton from "./ShareButton";

// Blue and orange match the bars in the company table. The parts that aren't companies
// are greys (light for cash inside funds, dark for crypto), and the cash in your
// accounts is aqua. The funds donut uses none of these, so a colour means one thing.
const SLICE_COLORS: Record<string, string> = {
  direct: "var(--series-direct)",
  funds: "var(--series-funds)",
  fundOther: "var(--series-neutral)",
  notLooked: "var(--series-none)",
  cash: "var(--series-cash)",
};

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
  title?: string; // The summary's heading: what's shown, like "Wealthsimple · TFSA".
};

export default function LookThrough({ report, history = { state: "loading" }, title }: Props) {
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

  // One donut for everything in the net worth figure: what you bought, the companies in
  // your funds, the cash inside them, crypto, and the cash in your accounts.
  const parts = netWorthBreakdown(result, cash);
  const inFunds = parts.find((part) => part.key === "funds")?.value ?? 0;
  const unopened = sumOf(result.insideUnopenedFunds, (fund) => fund.value);
  const cashEquivalentsText = result.cashEquivalents
    .map((holding) => `${money(holding.value)} in ${holding.symbol}`)
    .join(", ");
  // The slices that need explaining get an ⓘ note, instead of sentences under the chart.
  const notes: Record<string, string | undefined> = {
    funds:
      inFunds > 0 && result.total > 0
        ? `${percentText(inFunds / result.total)} of your holdings is in companies you didn't buy yourself, held through your funds.`
        : undefined,
    fundOther:
      "The cash, futures and currency contracts your funds hold, and any funds inside them we can't open yet.",
    cash:
      cashEquivalentsText && cashNotLoaded.length === 0
        ? `Includes ${cashEquivalentsText}, a money market fund.`
        : undefined,
  };
  const slices: DonutSlice[] = parts.map((part) => ({ ...part, color: SLICE_COLORS[part.key], note: notes[part.key] }));
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
            <p className="muted small">
              Total net worth
              {/* Mixing a USD and a CAD account converts one into the other. */}
              {result.fxAsOf && (
                <>
                  {" "}
                  <InfoPopover label="About the exchange rate">
                    {result.currency === "CAD" ? "US$" : "CA$"} amounts are converted to {result.currency} at{" "}
                    {FX.cadPerUsd} CAD per USD ({formatDate(result.fxAsOf)}).
                  </InfoPopover>
                </>
              )}
            </p>
            <p className="net-worth-value">{money(netWorth)}</p>
            <Donut
              slices={slices}
              money={money}
              centerValue={formatMoney(netWorth, result.currency, { compact: true })}
              centerLabel="net worth"
              ariaLabel={`Your net worth: ${parts.map((part) => `${part.label} ${money(part.value)}`).join(", ")}`}
            />
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

      {/* Funds before companies: the funds are what you bought, and clicking one filters
          the company table below it to what's inside. */}
      <FundsCard result={result} money={money} onFundClick={showFund} />

      <CompanyTable report={report} money={money} view={view} onViewChange={setView} />

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
