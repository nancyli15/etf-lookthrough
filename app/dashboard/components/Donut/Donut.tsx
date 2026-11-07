// A donut chart: one whole split into parts, each labelled beside it with its
// amount and share, so nothing depends on reading colour or slice size alone.
// Plain SVG, no chart library. Each slice is a stretch of one circle's outline
// (stroke-dasharray), with a 2px gap between slices.
import type { ReactNode } from "react";
import { percentText } from "@/lib/display/format";
import InfoPopover from "../InfoPopover/InfoPopover";
import "./Donut.css";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  note?: ReactNode; // What this slice means, in an ⓘ next to its label, for the ones that need it.
};

type Props = {
  slices: DonutSlice[];
  money: (value: number) => string;
  centerValue: string; // The total, short enough for the hole: "CA$109.5K". The legend has exact amounts.
  centerLabel: string; // Under the total, like "net worth".
  ariaLabel: string;
  legend?: boolean; // Off when a table beside the donut already names every slice.
};

const SIZE = 160;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // Between slices, in the same units as the circle's outline.
const MIN_VISIBLE = 2; // A 0.1% slice still shows as a sliver, and its label says the real size.

export default function Donut({
  slices,
  money,
  centerValue,
  centerLabel,
  ariaLabel,
  legend = true,
}: Props) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;
  const gap = slices.length > 1 ? GAP : 0;

  let offset = 0;
  const arcs = slices.map((slice) => {
    const share = slice.value / total;
    const length = Math.max(share * CIRCUMFERENCE - gap, MIN_VISIBLE);
    const arc = { ...slice, share, length, offset };
    offset += share * CIRCUMFERENCE;
    return arc;
  });

  return (
    <div className="donut">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={ariaLabel}
        className="donut-chart"
      >
        {/* Start at 12 o'clock and go clockwise. */}
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
            >
              <title>{`${arc.label}: ${money(arc.value)} (${percentText(arc.share)})`}</title>
            </circle>
          ))}
        </g>
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="donut-total"
        >
          {centerValue}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 16}
          textAnchor="middle"
          className="donut-caption"
        >
          {centerLabel}
        </text>
      </svg>
      {legend && (
        <ul className="donut-legend">
          {arcs.map((arc) => (
            <li key={arc.key}>
              <i
                className="swatch"
                style={{ background: arc.color }}
                aria-hidden="true"
              />
              <span className="donut-label">
                {arc.label}
                {arc.note && (
                  <>
                    {" "}
                    <InfoPopover label={`About "${arc.label}"`}>
                      {arc.note}
                    </InfoPopover>
                  </>
                )}
              </span>
              <span className="num">{money(arc.value)}</span>
              <span className="num muted">{percentText(arc.share)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
