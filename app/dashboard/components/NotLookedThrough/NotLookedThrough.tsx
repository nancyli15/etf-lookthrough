// Holdings we couldn't open into companies: crypto, cash-like funds, and funds
// held inside your funds that we don't have a file for yet.
import { displayName } from "@/lib/display/names/names";
import type { LookThroughResult } from "@/lib/analysis/lookthrough/lookthrough";

type Props = {
  result: LookThroughResult;
  money: (value: number) => string;
};

export default function NotLookedThrough({ result, money }: Props) {
  if (result.notLookedThrough.length === 0 && result.insideUnopenedFunds.length === 0) return null;
  return (
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
  );
}
