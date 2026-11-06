"use client";
// A company's dropdown in the combined table. The wording and math are in
// lib/details.ts, where they're tested; this file only lays them out.
import { useId, useState } from "react";
import type { Activity } from "../../lib/activities";
import { activityNote, activityText, controlText, insideFunds, ownershipText, weightText, whatIfText } from "../../lib/details";
import type { CompanyExposure, FundSummary } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";

const START_MOVE = -10; // Percent. A fall is the question people usually ask first.

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
  const moveText = `${move > 0 ? "+" : move < 0 ? "−" : ""}${Math.abs(move)}%`;
  const note = activityNote(company, activities.length, activitySince, activityNotLoaded, longDate);

  return (
    <div className="details">
      <div className="details-column">
        <p>{ownershipText(company, money)}</p>
        {company.byFund.length > 0 && (
          <ul className="details-list">
            {insideFunds(company, funds).map((fund) => (
              <li key={fund.symbol}>
                <i className="swatch funds" aria-hidden="true" /> Inside {fund.symbol}: {name} is {weightText(fund.weight)} of
                the fund, so {money(fund.value)} of yours.
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{controlText(company, money)}</p>
      </div>

      <div className="details-column">
        <label className="small" htmlFor={sliderId}>
          What if {name} moves? <strong>{moveText}</strong>
        </label>
        <input
          id={sliderId}
          className="slider"
          type="range"
          min={-50}
          max={50}
          step={1}
          value={move}
          onChange={(event) => setMove(Number(event.target.value))}
          aria-valuetext={`${moveText}. ${whatIfText(company, holdingsTotal, move / 100, money)}`}
        />
        <div className="slider-ends muted small" aria-hidden="true">
          <span>−50%</span>
          <span>0</span>
          <span>+50%</span>
        </div>
        <p>{whatIfText(company, holdingsTotal, move / 100, money)}</p>

        <p className="small details-heading">Your recent activity</p>
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
      </div>
    </div>
  );
}
