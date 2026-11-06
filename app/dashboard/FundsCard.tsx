// Everything about your funds in one card: how much of each we can trace to
// companies, the money inside them that isn't companies, and where they overlap.
// It replaces three separate cards and the fund table's footer rows.
import { percentText } from "../../lib/format";
import type { LookThroughResult } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";

type Props = {
  result: LookThroughResult;
  money: (value: number) => string;
};

export default function FundsCard({ result, money }: Props) {
  if (result.funds.length === 0) return null;
  const share = (value: number) => percentText(result.total ? value / result.total : 0);
  const unopened = result.insideUnopenedFunds.reduce((sum, fund) => sum + fund.value, 0);
  const fundsTotal = result.funds.reduce((sum, fund) => sum + fund.value, 0);

  return (
    <div className="card">
      <h2>Your funds</h2>
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
        <tfoot>
          <tr className="subtotal">
            <td>Cash and other non-stock holdings inside them</td>
            <td className="num">{money(result.otherInFunds)}</td>
            <td className="num">{share(result.otherInFunds)} of holdings</td>
          </tr>
          {unopened > 0 && (
            <tr className="subtotal">
              <td>Inside funds we can't open yet ({result.insideUnopenedFunds.map((fund) => fund.symbol).join(", ")})</td>
              <td className="num">{money(unopened)}</td>
              <td className="num">{share(unopened)} of holdings</td>
            </tr>
          )}
          <tr>
            <td>Total in your funds</td>
            <td className="num">{money(fundsTotal)}</td>
            <td className="num">{share(fundsTotal)} of holdings</td>
          </tr>
        </tfoot>
      </table>

      {result.overlaps.length > 0 && (
        <>
          <h3 className="subheading">Where your funds overlap</h3>
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
                  <td className="num">{overlap.basis === "same-list" ? "About 100%" : percentText(overlap.sharedWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
