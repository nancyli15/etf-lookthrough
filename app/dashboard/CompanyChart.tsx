// Bar chart of your biggest companies. Each bar is split into what you bought
// directly and what you own through funds. Clicking a bar selects that company.
// Plain HTML and CSS, no chart library, so every line can be explained.
import type { CompanyExposure } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";
import { percentText } from "../../lib/report";

const BARS = 10;

type Props = {
  companies: CompanyExposure[]; // Largest first.
  selectedKey?: string;
  onSelect: (key: string) => void;
  money: (value: number) => string;
};

export default function CompanyChart({ companies, selectedKey, onSelect, money }: Props) {
  const top = companies.slice(0, BARS);
  if (top.length === 0) return null;
  // Bars are scaled to the biggest company, so it fills the track and the rest compare to it.
  const largest = top[0].total;
  const hasDirect = top.some((company) => company.direct > 0);
  const hasFunds = top.some((company) => company.throughFunds > 0);

  return (
    <div className="card">
      <h2>Your biggest companies</h2>
      {hasDirect && hasFunds && (
        <div className="legend small" aria-hidden="true">
          <span><i className="swatch direct" /> Bought directly</span>
          <span><i className="swatch funds" /> Through funds</span>
        </div>
      )}
      <ul className="bars">
        {top.map((company) => {
          const description = `${shortName(company.name)}: ${money(company.total)}, ${percentText(company.percent)} of holdings. Directly ${money(company.direct)}, through funds ${money(company.throughFunds)}.`;
          return (
            <li key={company.key}>
              <button
                type="button"
                className={`bar-row${company.key === selectedKey ? " selected" : ""}`}
                onClick={() => onSelect(company.key)}
                aria-pressed={company.key === selectedKey}
                aria-label={description}
                title={description}
              >
                <span className="bar-label">{shortName(company.name)}</span>
                <span className="bar-track">
                  {company.direct > 0 && (
                    <span className="bar direct" style={{ width: `${(company.direct / largest) * 100}%` }} />
                  )}
                  {company.throughFunds > 0 && (
                    <span className="bar funds" style={{ width: `${(company.throughFunds / largest) * 100}%` }} />
                  )}
                </span>
                <span className="bar-value">{percentText(company.percent)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small spaced">Click a company to see where it comes from. The tables have every company.</p>
    </div>
  );
}
