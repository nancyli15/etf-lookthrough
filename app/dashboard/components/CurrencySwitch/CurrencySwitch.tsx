"use client";
// USD or CAD, like a light/dark switch. By default the page follows the accounts:
// CAD if any Canadian money is shown, otherwise USD. Flipping it recalculates the
// whole page in the chosen currency, at the one dated rate in data/fx.ts.
import type { ReportCurrency } from "@/lib/analysis/report";
import "./CurrencySwitch.css";

const OPTIONS: { currency: ReportCurrency; label: string }[] = [
  { currency: "USD", label: "USD" },
  { currency: "CAD", label: "CAD" },
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
