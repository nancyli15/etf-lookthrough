"use client";
// US$ or CA$, like a light/dark switch. By default the page follows the accounts:
// CA$ if any Canadian money is shown, otherwise US$. Flipping it recalculates the
// whole page in the chosen currency, at the one dated rate in data/fx.ts.
import type { ReportCurrency } from "../../lib/report";

const OPTIONS: { currency: ReportCurrency; label: string }[] = [
  { currency: "USD", label: "US$" },
  { currency: "CAD", label: "CA$" },
];

type Props = {
  value: ReportCurrency;
  onChange: (currency: ReportCurrency) => void;
};

export default function CurrencySwitch({ value, onChange }: Props) {
  return (
    <div className="switch" role="group" aria-label="Show amounts in">
      {OPTIONS.map((option) => (
        <button
          key={option.currency}
          type="button"
          className={`switch-option${value === option.currency ? " current" : ""}`}
          aria-pressed={value === option.currency}
          onClick={() => value !== option.currency && onChange(option.currency)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
