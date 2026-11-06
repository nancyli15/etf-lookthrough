"use client";
// Which of your funds hold the same companies, as a grid: each cell is one pair,
// darker blue means more overlap. Clicking a cell shows that pair in dollars: how
// much of your money sits in the same companies through both.
// Replaces a list of six rows that all said "Mostly Apple, NVIDIA, Microsoft".
import { useState } from "react";
import { percentText } from "../../lib/format";
import type { FundOverlap, FundSummary } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";

type Props = {
  funds: FundSummary[];
  overlaps: FundOverlap[]; // Largest first.
  money: (value: number) => string;
};

// One hue, light to dark, from the checked sequential ramp. White text from step 450 on.
const RAMP = [
  { below: 0.1, fill: "#e8f1fd", text: "var(--text)" },
  { below: 0.25, fill: "#b7d3f6", text: "var(--text)" },
  { below: 0.4, fill: "#86b6ef", text: "var(--text)" },
  { below: 0.6, fill: "#2a78d6", text: "#fff" },
  { below: 0.8, fill: "#1c5cab", text: "#fff" },
  { below: Infinity, fill: "#104281", text: "#fff" },
];

const shade = (weight: number) => RAMP.find((step) => weight < step.below)!;
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function overlapText(overlap: FundOverlap): string {
  return overlap.basis === "same-list" ? "~100%" : percentText(overlap.sharedWeight);
}

export default function OverlapMatrix({ funds, overlaps, money }: Props) {
  const [selectedKey, setSelectedKey] = useState(() => (overlaps[0] ? pairKey(overlaps[0].fundA, overlaps[0].fundB) : ""));
  if (overlaps.length === 0) return null;

  const byPair = new Map(overlaps.map((overlap) => [pairKey(overlap.fundA, overlap.fundB), overlap]));
  const selected = byPair.get(selectedKey) ?? overlaps[0];
  const symbols = funds.map((fund) => fund.symbol);
  // Each pair appears once, above the diagonal, so the first column and the last row
  // would always be empty. Leaving them out keeps the grid small.
  const rows = symbols.slice(0, -1);
  const columns = symbols.slice(1);

  return (
    <div className="overlap">
      <table className="overlap-grid">
        <thead>
          <tr>
            <th aria-hidden="true" />
            {columns.map((symbol) => (
              <th key={symbol} scope="col">
                {symbol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row}>
              <th scope="row">{row}</th>
              {columns.map((column, columnIndex) => {
                // Each pair once: the grid is symmetric, so the lower half stays empty.
                if (columnIndex < rowIndex) return <td key={column} className="overlap-empty" />;
                const overlap = byPair.get(pairKey(row, column));
                if (!overlap) return <td key={column} className="overlap-empty" />;
                const { fill, text } = shade(overlap.sharedWeight);
                const key = pairKey(row, column);
                return (
                  <td key={column}>
                    <button
                      type="button"
                      className={`overlap-cell${key === pairKey(selected.fundA, selected.fundB) ? " selected" : ""}`}
                      style={{ background: fill, color: text }}
                      onClick={() => setSelectedKey(key)}
                      aria-pressed={key === pairKey(selected.fundA, selected.fundB)}
                      aria-label={`${row} and ${column}: ${overlapText(overlap)} the same, ${money(overlap.sharedValue)} of your money`}
                    >
                      {overlapText(overlap)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="overlap-detail" aria-live="polite">
        <p>
          <strong>
            {selected.fundA} and {selected.fundB}
          </strong>
          {selected.basis === "same-list"
            ? " track the same index, so they hold the same companies."
            : ` hold ${percentText(selected.sharedWeight)} of the same companies.`}
        </p>
        <p className="muted small">
          {money(selected.sharedValue)} of your money is in the same companies through both.
          {selected.sharedCompanies.length > 0 &&
            ` Mostly ${selected.sharedCompanies.slice(0, 3).map(shortName).join(", ")}.`}
          {selected.incomplete && " One of these holds a fund we can't open yet, so the real overlap is likely higher."}
        </p>
      </div>
    </div>
  );
}
