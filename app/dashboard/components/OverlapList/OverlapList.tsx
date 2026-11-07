"use client";
// Where your funds overlap, as a ranked list instead of a grid: one row per pair of
// funds, most overlap first, so nobody has to cross-reference rows and columns.
// Above it, the biggest overlap in dollars: how much of your money is in that pair.
//
// The overlap percentage is weighted (see lib/analysis/lookthrough.ts, fundOverlap): for each
// company both funds hold, take the smaller of its two weights, and add those up.
import { useState } from "react";
import { percentText } from "@/lib/display/format";
import type { FundOverlap, FundSummary } from "@/lib/analysis/lookthrough";
import { shortName } from "@/lib/display/names";
import InfoPopover from "../InfoPopover/InfoPopover";
import "./OverlapList.css";

// Four funds make six pairs, which fit. More funds make many more, so the rest wait behind a button.
const SHOWN = 6;

type Props = {
  funds: FundSummary[];
  overlaps: FundOverlap[]; // Largest first.
  money: (value: number) => string;
};

const percentOf = (overlap: FundOverlap) => (overlap.basis === "same-list" ? "~100%" : percentText(overlap.sharedWeight));

function mostly(overlap: FundOverlap): string {
  if (overlap.basis === "same-list") return "Same index, so the same companies";
  if (overlap.sharedCompanies.length === 0) return "No companies in common";
  return `Mostly ${overlap.sharedCompanies.slice(0, 3).map(shortName).join(", ")}`;
}

export default function OverlapList({ funds, overlaps, money }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (overlaps.length === 0) return null;

  const valueOf = (symbol: string) => funds.find((fund) => fund.symbol === symbol)?.value ?? 0;
  const fundsTotal = funds.reduce((sum, fund) => sum + fund.value, 0);
  const top = overlaps[0];
  const together = valueOf(top.fundA) + valueOf(top.fundB);
  const shown = showAll ? overlaps : overlaps.slice(0, SHOWN);

  return (
    <div className="overlap">
      <h3 className="subheading">
        Where your funds overlap{" "}
        <InfoPopover label="How overlap is measured">
          <span className="info-line">
            For each company both funds hold, we take the smaller of its two weights, and add those up.
          </span>
          <span className="info-line muted">
            So "52.8%" means 52.8% of each fund's money is in the same companies, in the same amounts. It isn't a count
            of companies: two funds can share hundreds of small companies and still overlap little.
          </span>
        </InfoPopover>
      </h3>

      {/* The biggest overlap, in dollars first: how much of your money is in this pair. */}
      <div className="overlap-insight">
        <p className="muted small">Your biggest overlap</p>
        <p className="overlap-amount">{money(together)}</p>
        <p className="small">
          in{" "}
          <strong>
            {top.fundA} ({money(valueOf(top.fundA))})
          </strong>{" "}
          and{" "}
          <strong>
            {top.fundB} ({money(valueOf(top.fundB))})
          </strong>
          , {percentText(fundsTotal ? together / fundsTotal : 0)} of your funds.
        </p>
        <p className="muted small">
          {top.basis === "same-list"
            ? "They track the same index, so they hold the same companies. Holding both doesn't spread your money over more companies."
            : `${percentOf(top)} of each one's money is in the same companies. ${mostly(top)}.`}
          {top.incomplete && " One of them holds a fund we can't open yet, so the real overlap is likely higher."}
        </p>
      </div>

      <ol className="overlap-list">
        {shown.map((overlap) => (
          <li key={`${overlap.fundA}|${overlap.fundB}`}>
            <span className="overlap-pair">
              {overlap.fundA} + {overlap.fundB}
            </span>
            <span className="overlap-bar">
              <span className="bar-track" role="img" aria-label={`${percentOf(overlap)} the same`}>
                <span className="bar overlap-fill" style={{ width: `${Math.min(overlap.sharedWeight, 1) * 100}%` }} />
              </span>
              <span className="muted small">
                {mostly(overlap)}
                {overlap.incomplete && " (likely higher: holds a fund we can't open)"}
              </span>
            </span>
            <span className="num overlap-percent">{percentOf(overlap)}</span>
          </li>
        ))}
      </ol>
      {overlaps.length > SHOWN && (
        <button className="link" type="button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${overlaps.length} pairs`}
        </button>
      )}
    </div>
  );
}
