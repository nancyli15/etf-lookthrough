// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested. It puts the cards in order; the bigger ones
// (NetWorthCard, CompanyTable, FundsCard, NotLookedThrough) are their own components.
//
// Top to bottom: the summary (net worth, split into stocks, funds, crypto and cash)
// beside the account value chart, the biggest-company finding, every company, your
// funds and their overlap, and what couldn't be looked through. Clicking a fund's name
// shows its companies in the table above it. One page scroll; on a phone, the top pair stacks.
import { useState } from "react";
import { FX } from "@/data/fx";
import { formatDate, formatMoney, listOf, muchIsInUnopenedFunds, percentText, unopenedFunds } from "@/lib/display/format/format";
import type { HistoryLoad } from "@/lib/portfolio/history/history";
import { fundView, type CompanyView } from "@/lib/display/paging/paging";
import type { Report } from "@/lib/analysis/report/report";
import AccountValueChart from "../AccountValueChart/AccountValueChart";
import CompanyTable from "../CompanyTable/CompanyTable";
import FundsCard from "../FundsCard/FundsCard";
import BiggestCompany from "../BiggestCompany/BiggestCompany";
import NetWorthCard from "../NetWorthCard/NetWorthCard";
import NotLookedThrough from "../NotLookedThrough/NotLookedThrough";
import "./LookThrough.css";

type Props = {
  report: Report;
  history?: HistoryLoad; // Defaults to "loading" so tests and previews can render without it.
  includes?: string; // "Includes all 4 accounts: …", when there's more than one account.
  title?: string; // The summary's heading: what's shown, like "Wealthsimple · TFSA".
};

export default function LookThrough({ report, history = { state: "loading" }, includes, title }: Props) {
  const { result, headline, skipped, failedAccounts, netWorth } = report;

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

  // Funds you hold and funds inside them that we have no holdings file for.
  const unopened = unopenedFunds(result);
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
        {netWorth !== 0 && <NetWorthCard report={report} money={money} title={title} includes={includes} />}
        {result.total !== 0 && <AccountValueChart history={history} currency={result.currency} money={money} />}
      </div>

      <div className="card">
        <p className="headline">{headline?.title ?? "There's nothing to look through in these accounts yet."}</p>
        {headline && <p className="muted">{headline.detail}</p>}
        <BiggestCompany company={result.companies[0]} money={money} />
        {muchIsInUnopenedFunds(result) && (
          <p className="error">
            {shareOf(unopened.value)} of your holdings is in funds we can't open yet ({listOf(unopened.symbols)}), so
            company totals are likely understated.
          </p>
        )}
      </div>

      {/* Companies first: what you own through everything is the point of the page.
          Your funds come after, and clicking one jumps back up to its companies. */}
      <CompanyTable report={report} money={money} view={view} onViewChange={setView} />

      <FundsCard result={result} money={money} onFundClick={showFund} />

      <NotLookedThrough result={result} money={money} />

      {/* Only with something to look through: for an account with just cash, like an
          empty FHSA, notes about holdings, fund dates and percentages are noise. */}
      {result.total !== 0 && (
        <p className="muted small">
          {fundDates && <>Fund data as of {fundDates}. </>}
          {result.fxAsOf && <>Converted at {FX.cadPerUsd} CAD per USD ({FX.source}, {formatDate(result.fxAsOf)}). </>}
          Percentages are of your holdings, so they don't include cash.
        </p>
      )}
    </>
  );
}
