// Where one company's money comes from: bought directly, and through each fund.
// Uses the per-fund amounts from lib/lookthrough.ts (byFund).
import type { CompanyExposure } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";
import { percentText } from "../../lib/format";

type Props = {
  company: CompanyExposure;
  money: (value: number) => string;
};

// The rows of the card beside the bar chart: one per source, with its share.
export function SourceRows({ company, money }: Props) {
  const sources = [
    ...(company.direct > 0 ? [{ label: "Bought directly", value: company.direct, kind: "direct" }] : []),
    ...company.byFund.map((fund) => ({ label: `Through ${fund.symbol}`, value: fund.value, kind: "funds" })),
  ];

  return (
    <table>
      <tbody>
        {sources.map((source) => (
          <tr key={source.label}>
            <td>
              <i className={`swatch ${source.kind}`} aria-hidden="true" /> {source.label}
            </td>
            <td className="num">{money(source.value)}</td>
            <td className="num muted">{percentText(company.total ? source.value / company.total : 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CompanyBreakdown({ company, money }: Props) {
  return (
    <div className="card">
      <p className="muted small">Where it comes from</p>
      <h2>
        {shortName(company.name)} <span className="muted">{company.symbol}</span>
      </h2>
      <p>
        <strong>{money(company.total)}</strong>{" "}
        <span className="muted">· {percentText(company.percent)} of your holdings</span>
      </p>
      <SourceRows company={company} money={money} />
    </div>
  );
}
