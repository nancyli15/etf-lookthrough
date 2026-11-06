"use client";
// A company's dropdown in the combined table. The wording and math are in
// lib/details.ts, where they're tested; this file only lays them out.
import { useId, useState } from "react";
import type { Activity } from "../../lib/activities";
import { activityNote, activityText, controlText, insideFunds, movesText, ownershipText, weightText } from "../../lib/details";
import type { CompanyExposure, FundSummary } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";

const START_MOVE = 10; // Percent: a round number that's easy to check in your head.

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
  const result = movesText(company, holdingsTotal, move / 100, money);
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
        <label className="small details-heading" htmlFor={sliderId}>
          If {name} moves <strong>{move}%</strong>
        </label>
        <input
          id={sliderId}
          className="slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={move}
          onChange={(event) => setMove(Number(event.target.value))}
          aria-valuetext={`${move}%. ${result}`}
        />
        <div className="slider-ends muted small" aria-hidden="true">
          <span>0%</span>
          <span>100%</span>
        </div>
        <p>{result}</p>

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
