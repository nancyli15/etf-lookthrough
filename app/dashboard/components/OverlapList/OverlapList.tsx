"use client";
// Where your funds overlap, as a ranked list instead of a grid: one row per pair of
// funds, most overlap first, so nobody has to cross-reference rows and columns.
// Above it, the biggest overlap in dollars: how much of your money is in that pair.
//
// The overlap percentage is weighted (see lib/analysis/lookthrough/overlap.ts): for each
// company both funds hold, take the smaller of its two weights, and add those up.
import { useState } from "react";
import { percentText, sumOf } from "@/lib/display/format/format";
import type { FundOverlap, FundSummary } from "@/lib/analysis/lookthrough/lookthrough";
import { shortName } from "@/lib/display/names/names";
import InfoPopover from "../InfoPopover/InfoPopover";
import "./OverlapList.css";

// Four funds make six pairs, which fit. More funds make many more, so the rest wait behind a button.
const PAIRS_SHOWN_AT_FIRST = 6;
const COMPANIES_NAMED = 3;

type Props = {
  funds: FundSummary[];
  overlaps: FundOverlap[]; // Largest first.
  money: (value: number) => string;
};

// "52.8%", or "~100%" for two funds that share one list (FXAIX and SPY).
const overlapPercentText = (overlap: FundOverlap) =>
  overlap.basis === "same-list" ? "~100%" : percentText(overlap.sharedWeight);

// "Mostly Apple, Microsoft, NVIDIA": the biggest companies the pair has in common.
function sharedCompaniesText(overlap: FundOverlap): string {
  if (overlap.basis === "same-list") return "Same index, so the same companies";
  if (overlap.sharedCompanies.length === 0) return "No companies in common";
  return `Mostly ${overlap.sharedCompanies.slice(0, COMPANIES_NAMED).map(shortName).join(", ")}`;
}

export default function OverlapList({ funds, overlaps, money }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (overlaps.length === 0) return null;

  const valueOf = (symbol: string) => funds.find((fund) => fund.symbol === symbol)?.value ?? 0;
  const fundsTotal = sumOf(funds, (fund) => fund.value);
  const biggest = overlaps[0];
  const biggestPairValue = valueOf(biggest.fundA) + valueOf(biggest.fundB);
  const visiblePairs = showAll ? overlaps : overlaps.slice(0, PAIRS_SHOWN_AT_FIRST);

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
        <p className="overlap-amount">{money(biggestPairValue)}</p>
        <p className="small">
          in{" "}
          <strong>
            {biggest.fundA} ({money(valueOf(biggest.fundA))})
          </strong>{" "}
          and{" "}
          <strong>
            {biggest.fundB} ({money(valueOf(biggest.fundB))})
          </strong>
          , {percentText(fundsTotal ? biggestPairValue / fundsTotal : 0)} of your funds.
        </p>
        <p className="muted small">
          {biggest.basis === "same-list"
            ? "They track the same index, so they hold the same companies. Holding both doesn't spread your money over more companies."
            : `${overlapPercentText(biggest)} of each one's money is in the same companies. ${sharedCompaniesText(biggest)}.`}
          {biggest.incomplete && " One of them holds a fund we can't open yet, so the real overlap is likely higher."}
        </p>
      </div>

      <ol className="overlap-list">
        {visiblePairs.map((overlap) => (
          <li key={`${overlap.fundA}|${overlap.fundB}`}>
            <span className="overlap-pair">
              {overlap.fundA} + {overlap.fundB}
            </span>
            <span className="overlap-bar">
              <span className="bar-track" role="img" aria-label={`${overlapPercentText(overlap)} the same`}>
                <span className="bar overlap-fill" style={{ width: `${Math.min(overlap.sharedWeight, 1) * 100}%` }} />
              </span>
              <span className="muted small">
                {sharedCompaniesText(overlap)}
                {overlap.incomplete && " (likely higher: holds a fund we can't open)"}
              </span>
            </span>
            <span className="num overlap-percent">{overlapPercentText(overlap)}</span>
          </li>
        ))}
      </ol>
      {overlaps.length > PAIRS_SHOWN_AT_FIRST && (
        <button className="link" type="button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${overlaps.length} pairs`}
        </button>
      )}
    </div>
  );
}
