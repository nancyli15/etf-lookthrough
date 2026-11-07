// Two numbers under the headline, about your biggest company: how much you own in
// total, and how much of that comes through your funds. What looking through found,
// without repeating the company table below, which has every company.
import { percentText } from "@/lib/display/format";
import type { CompanyExposure } from "@/lib/analysis/lookthrough";
import { shortName } from "@/lib/display/names";
import "./BiggestCompany.css";

type Props = {
  company: CompanyExposure | undefined; // The biggest, from result.companies[0].
  money: (value: number) => string;
};

export default function BiggestCompany({ company, money }: Props) {
  // Only worth showing when funds add something: a company you only bought yourself
  // is already on your brokerage's list.
  if (!company || company.throughFunds <= 0) return null;
  const name = shortName(company.name);
  return (
    <div className="insight-tiles">
      <div className="insight-tile">
        <p className="muted small">Your {name}, in total</p>
        <p className="insight-value">{money(company.total)}</p>
        <p className="muted small">
          {company.direct > 0 ? "Your shares plus your funds" : "All of it through your funds"}
        </p>
      </div>
      <div className="insight-tile">
        <p className="muted small">{name} through your funds</p>
        <p className="insight-value">{money(company.throughFunds)}</p>
        <p className="muted small">{percentText(company.throughFunds / company.total)} of your {name}</p>
      </div>
    </div>
  );
}
