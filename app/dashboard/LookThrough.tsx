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
  const named = result.companies.reduce((sum, c) => sum + c.total, 0);
  const excluded = result.notLookedThrough.reduce((sum, n) => sum + n.value, 0);
  const unopened = result.insideUnopenedFunds.reduce((sum, u) => sum + u.value, 0);
  const share = (value: number) => percentText(result.total ? value / result.total : 0);
  const fundDates = [...new Set(result.funds.map((f) => f.asOf))].map(formatDate).join(", ");

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
          {result.unconverted.map((u) => `${u.symbol} (${money(u.value, u.currency)})`).join(", ")}.
        </div>
      )}

      <div className="card">
        <p className="headline">{headline ?? "There's nothing to look through in these accounts yet."}</p>
        <p className="muted">
          {money(result.total)} in total: {share(named)} traced to named companies, {share(result.otherInFunds)} in
          funds' smaller holdings and cash
          {unopened > 0 && <>, {share(unopened)} inside funds we can't open yet</>}
          {excluded > 0 && <>, {share(excluded)} not looked through</>}.
        </p>
        {hasLargeGap(result) && (
          <p className="error">
            {share(unopened)} of your portfolio sits inside funds we can't open yet (
            {result.insideUnopenedFunds.map((u) => u.symbol).join(", ")}), so company totals are likely understated.
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
              {companies.map((c) => (
                <tr key={c.key}>
                  <td>
                    {displayName(c.name)} <span className="muted">{c.symbol}</span>
                    {c.viaFunds.length > 0 && <div className="muted small">via {c.viaFunds.join(", ")}</div>}
                  </td>
                  <td className="num">{c.direct > 0 ? money(c.direct) : "–"}</td>
                  <td className="num">{c.throughFunds > 0 ? money(c.throughFunds) : "–"}</td>
                  <td className="num">{money(c.total)}</td>
                  <td className="num">{percentText(c.percent)}</td>
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
              {result.overlaps.map((o) => (
                <tr key={`${o.a}-${o.b}`}>
                  <td>
                    {o.a} and {o.b}
                    <div className="muted small">
                      {o.basis === "same-list"
                        ? "Both track the same index."
                        : o.sharedCompanies.length > 0
                          ? `Mostly ${o.sharedCompanies.slice(0, 3).map(displayName).join(", ")}.`
                          : "No shared companies among their largest holdings."}
                      {o.incomplete && " One of these holds a fund we can't open yet, so the real overlap is likely higher."}
                    </div>
                  </td>
                  <td className="num">
                    {o.basis === "same-list" ? "About 100%" : `At least ${percentText(o.sharedWeight)}`}
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
              {result.funds.map((f) => (
                <tr key={f.symbol}>
                  <td>
                    {f.symbol} <span className="muted">{f.name}</span>
                    {f.approximatedBy && (
                      <div className="muted small">Uses {f.approximatedBy}'s holdings, because both track the same index.</div>
                    )}
                  </td>
                  <td className="num">{money(f.value)}</td>
                  <td className="num">{percentText(1 - f.otherWeight - f.unopenedWeight)}</td>
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
              {result.notLookedThrough.map((n, i) => (
                <tr key={`${n.symbol}-${i}`}>
                  <td>
                    {n.symbol} <span className="muted">{displayName(n.name)}</span>
                    <div className="muted small">{n.reason}</div>
                  </td>
                  <td className="num">{money(n.value)}</td>
                </tr>
              ))}
              {result.insideUnopenedFunds.map((u) => (
                <tr key={u.symbol}>
                  <td>
                    {u.symbol} <span className="muted">{displayName(u.name)}</span>
                    <div className="muted small">Held inside one of your funds. We don't have its contents yet.</div>
                  </td>
                  <td className="num">{money(u.value)}</td>
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
