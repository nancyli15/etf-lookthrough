// The summary card: total net worth, split into stocks you bought, funds, crypto
// and cash, with a note when the total is incomplete or differs from SnapTrade's.
import { FX } from "@/data/fx";
import { formatDate, sumOf } from "@/lib/display/format/format";
import type { Report } from "@/lib/analysis/report/report";
import InfoPopover from "../InfoPopover/InfoPopover";
import "./NetWorthCard.css";

type Props = {
  report: Report;
  money: (value: number, currency?: string) => string;
  title?: string; // What's shown, like "Wealthsimple · TFSA".
  includes?: string; // "Includes all 4 accounts: …", when there's more than one account.
};

export default function NetWorthCard({ report, money, title, includes }: Props) {
  const { result, skipped, failedAccounts, cash, cashNotLoaded, cashUnconverted, netWorth, brokerageTotal, differsFromBrokerage } =
    report;

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

  return (
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
  );
}
