"use client";
// A company's dropdown in the combined table. The wording and math are in
// lib/display/details.ts, where they're tested; this file only lays them out.
//
// Three sections, each with one clear answer: how much you own, which funds it
// comes from (as bars), and what a price move would do. Then your own trades.
import { useId, useState } from "react";
import type { Activity } from "@/lib/portfolio/activities";
import {
  activityNote,
  activityText,
  controlText,
  insideFunds,
  movesParts,
  movesText,
  ownershipLabel,
  ownershipText,
  signedMoney,
  weightText,
  whatIf,
} from "@/lib/display/details";
import { percentText } from "@/lib/display/format";
import InfoPopover from "../InfoPopover/InfoPopover";
import type { CompanyExposure, FundSummary } from "@/lib/analysis/lookthrough";
import { shortName } from "@/lib/display/names";
import "./CompanyDetails.css";

const START_MOVE = 10; // Percent: a round number that's easy to check in your head.
const MAX_MOVE = 50; // The slider runs from −50% to +50%, with 0 in the middle.

type Props = {
  company: CompanyExposure;
  funds: FundSummary[];
  holdingsTotal: number;
  activities: Activity[];
  activitySince?: string; // How far back the brokerage's history goes.
  activityNotLoaded: string[];
  money: (value: number, currency?: string) => string;
};

function shortDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function longDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

export default function CompanyDetails({
  company,
  funds,
  holdingsTotal,
  activities,
  activitySince,
  activityNotLoaded,
  money,
}: Props) {
  const [move, setMove] = useState(START_MOVE);
  const sliderId = useId();
  const name = shortName(company.name);
  const { change, share } = whatIf(company, holdingsTotal, move / 100);
  const result = movesText(company, holdingsTotal, move / 100, money);
  const parts = movesParts(company, move / 100, money);
  const note = activityNote(company, activities.length, activitySince, activityNotLoaded, longDate);
  const sources = insideFunds(company, funds);
  const moveLabel = `${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move)}%`;

  return (
    <div className="details">
      <div className="details-column">
        {/* 1. How much do I own? */}
        <section className="details-section">
          <span className="pill">{ownershipLabel(company)}</span>
          <div className="details-total">
            <span className="details-big num">{money(company.total)}</span>
            <span className="muted small"> total, {percentText(company.percent)} of your holdings</span>
          </div>
          <p className="muted">{ownershipText(company, money)}</p>
        </section>

        {/* 2. Why do I own it? One bar per source; the bars add up to the total above. */}
        <section className="details-section">
          <p className="details-heading">Where your {name} comes from</p>
          <ul className="details-sources">
            {company.direct > 0 && (
              <li className="details-source">
                <span className="source-name">Shares you bought</span>
                <span className="source-track" aria-hidden="true">
                  <span className="bar direct" style={{ width: `${(company.direct / company.total) * 100}%` }} />
                </span>
                <span className="num">{money(company.direct)}</span>
              </li>
            )}
            {sources.map((fund) => (
              <li key={fund.symbol} className="details-source">
                <span className="source-name">
                  {fund.symbol}{" "}
                  <span className="muted small">{weightText(fund.weight)} of fund</span>
                  {fund.approximatedBy && (
                    <InfoPopover label={`About ${fund.symbol}'s list`}>
                      Uses {fund.approximatedBy}'s list of companies, since both track the same index.
                    </InfoPopover>
                  )}
                </span>
                <span className="source-track" aria-hidden="true">
                  <span className="bar funds" style={{ width: `${fund.part * 100}%` }} />
                </span>
                <span className="num">{money(fund.value)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{controlText(company, money)}</p>
        </section>
      </div>

      <div className="details-column">
        {/* 3. Why does it matter? One big answer: the change in dollars and as a share of everything. */}
        <section className="details-section">
          <label className="details-heading" htmlFor={sliderId}>
            What if {name} moves <strong>{moveLabel}</strong>?
          </label>
          <input
            id={sliderId}
            className="slider"
            type="range"
            min={-MAX_MOVE}
            max={MAX_MOVE}
            step={1}
            value={move}
            onChange={(event) => setMove(Number(event.target.value))}
            aria-valuetext={`${moveLabel}. ${result}`}
          />
          <div className="slider-ends muted small" aria-hidden="true">
            <span>−{MAX_MOVE}%</span>
            <span>0%</span>
            <span>+{MAX_MOVE}%</span>
          </div>
          <div className={`details-result${change < 0 ? " loss" : change > 0 ? " gain" : ""}`}>
            <span className="details-big num">{signedMoney(change, money)}</span>
            <span className="small">
              {" "}
              {share === 0 ? "" : `${change < 0 ? "−" : "+"}${weightText(Math.abs(share))} of your holdings`}
            </span>
          </div>
          <p>{result}</p>
          {parts && <p className="muted small">{parts}</p>}
          <p className="muted small">An estimate. Assumes other prices, fund weights and exchange rates stay the same.</p>
        </section>

        {/* 4. Your own trades in it, from /activities. */}
        <section className="details-section">
          <p className="details-heading">Your direct trades</p>
          {activities.length > 0 && (
            <ul className="details-list small">
              {activities.map((activity, index) => (
                <li key={`${activity.date}-${index}`}>
                  <span className="muted">{shortDate(activity.date)}</span> · {activityText(activity, money)}
                </li>
              ))}
            </ul>
          )}
          {note.note && <p className="muted small">{note.note}</p>}
          {note.warning && <p className="error small">{note.warning}</p>}
        </section>
      </div>
    </div>
  );
}
