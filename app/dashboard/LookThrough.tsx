// The look-through screen. Only displays a Report: all the math and wording rules
// live in lib/ where they're tested.
import { useState } from "react";
import { FX } from "../../data/fx";
import { displayName, hasLargeGap, percentText, type Report } from "../../lib/report";

const TOP_COMPANIES = 15;

function formatDate(iso: string): string {
  // Date-only strings are midnight UTC, which can display as the day before locally.
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

export default function LookThrough({ report }: { report: Report }) {
  const [showAll, setShowAll] = useState(false);
  const { result, headline, skipped, failedAccounts, holdingsAsOf } = report;

  function money(value: number, currency = result.currency): string {
    try {
      return value.toLocaleString(undefined, { style: "currency", currency });
    } catch {
      // A currency code the browser doesn't recognise shouldn't break the page.
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  const companies = showAll ? result.companies : result.companies.slice(0, TOP_COMPANIES);
  const named = result.companies.reduce((sum, company) => sum + company.total, 0);
  const excluded = result.notLookedThrough.reduce((sum, holding) => sum + holding.value, 0);
  const unopened = result.insideUnopenedFunds.reduce((sum, fund) => sum + fund.value, 0);
  const share = (value: number) => percentText(result.total ? value / result.total : 0);
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

      <div className="card">
        <p className="headline">{headline ?? "There's nothing to look through in these accounts yet."}</p>
        {result.total !== 0 && (
          <p className="muted">
            {money(result.total)} in total: {share(named)} traced to named companies, {share(result.otherInFunds)} in
            funds' smaller holdings and cash
            {unopened > 0 && <>, {share(unopened)} inside funds we can't open yet</>}
            {excluded > 0 && <>, {share(excluded)} not looked through</>}.
          </p>
        )}
        {hasLargeGap(result) && (
          <p className="error">
            {share(unopened)} of your portfolio sits inside funds we can't open yet (
            {result.insideUnopenedFunds.map((fund) => fund.symbol).join(", ")}), so company totals are likely understated.
          </p>
        )}
      </div>

      {result.companies.length > 0 && (
        <div className="card">
          <h2>Your largest companies</h2>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Direct</th>
                <th className="num">Through funds</th>
                <th className="num">Total</th>
                <th className="num">% of portfolio</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.key}>
                  <td>
                    {displayName(company.name)} <span className="muted">{company.symbol}</span>
                    {company.viaFunds.length > 0 && <div className="muted small">via {company.viaFunds.join(", ")}</div>}
                  </td>
                  <td className="num">{company.direct > 0 ? money(company.direct) : "–"}</td>
                  <td className="num">{company.throughFunds > 0 ? money(company.throughFunds) : "–"}</td>
                  <td className="num">{money(company.total)}</td>
                  <td className="num">{percentText(company.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.companies.length > TOP_COMPANIES && (
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
                          ? `Mostly ${overlap.sharedCompanies.slice(0, 3).map(displayName).join(", ")}.`
                          : "No shared companies among their largest holdings."}
                      {overlap.incomplete && " One of these holds a fund we can't open yet, so the real overlap is likely higher."}
                    </div>
                  </td>
                  <td className="num">
                    {overlap.basis === "same-list" ? "About 100%" : `At least ${percentText(overlap.sharedWeight)}`}
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
                    {holding.symbol} <span className="muted">{displayName(holding.name)}</span>
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
        {fundDates && <>Fund data as of {fundDates}, largest holdings only. </>}
        {result.fxAsOf && <>Converted at {FX.cadPerUsd} CAD per USD ({FX.source}, {formatDate(result.fxAsOf)}). </>}
        Cash balances aren't included.
      </p>
    </>
  );
}
