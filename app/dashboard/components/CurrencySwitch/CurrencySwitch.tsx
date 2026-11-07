"use client";
// USD or CAD, like a light/dark switch. By default the page follows the accounts:
// CAD if any Canadian money is shown, otherwise USD. Flipping it recalculates the
// whole page in the chosen currency, at the one dated rate in data/fx.ts.
import type { ReportCurrency } from "@/lib/analysis/report/report";
import "./CurrencySwitch.css";

const CURRENCIES: ReportCurrency[] = ["USD", "CAD"];

type Props = {
  value: ReportCurrency;
  onChange: (currency: ReportCurrency) => void;
};

export default function CurrencySwitch({ value, onChange }: Props) {
  return (
    <div className="switch" role="group" aria-label="Show amounts in">
      {CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          className={`switch-option${value === currency ? " current" : ""}`}
          // aria-pressed tells screen readers which half is on.
          aria-pressed={value === currency}
          onClick={() => value !== currency && onChange(currency)}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
