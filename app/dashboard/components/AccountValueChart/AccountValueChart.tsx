"use client";
// Line chart of total account value over the past year, from SnapTrade's beta
// /balanceHistory endpoint. Dashboard.tsx loads /api/history and passes it in, so
// if the beta fails, only this card shows an error.
import { useMemo, useRef, useState } from "react";
import { formatDate, formatDayMonth, formatMoney, formatMonthYear } from "@/lib/display/format/format";
import { combineHistory, splitAtGaps, type HistoryLoad, type ValuePoint } from "@/lib/portfolio/history/history";
import "./AccountValueChart.css";

// The chart is drawn in these units, then scaled to fit the card (the SVG's viewBox).
const WIDTH = 560;
const HEIGHT = 200;
// Space around the plot for the axis labels. The left side grows to fit the longest label.
const MARGIN = { top: 12, right: 12, bottom: 30, left: 72 };

type Props = {
  history: HistoryLoad;
  currency: string;
  money: (value: number) => string;
};

export default function AccountValueChart({ history, currency, money }: Props) {
  const error = history.state === "failed" ? history.message : null;

  // Every account's history added into one line. Recalculated only when the data or currency changes.
  const combined = useMemo(
    () => (history.state === "loaded" ? combineHistory(history.accounts, currency) : null),
    [history, currency],
  );

  let body: React.ReactNode;
  if (error) {
    body = <p className="error small">Couldn't load account history ({error}). The rest of the page isn't affected.</p>;
  } else if (!combined) {
    body = <p className="muted small">Loading account history…</p>;
  } else if (combined.points.length < 2) {
    body = (
      <p className="muted small">
        No history to chart yet. SnapTrade says new accounts can take up to a day to get history.
      </p>
    );
  } else {
    body = (
      <LineChart
        points={combined.points}
        money={money}
        compactMoney={(value) => formatMoney(value, currency, { compact: true })}
      />
    );
  }

  const latest = combined?.points.at(-1);

  return (
    <div className="card">
      <h2>Account value</h2>
      {body}
      {combined && latest && combined.points.length >= 2 && (
        <p className="small spaced">
          Latest estimate: <strong>{money(latest.value)}</strong> on {formatDayMonth(latest.date)}
        </p>
      )}
      {combined && combined.missing.length > 0 && (
        <p className="error small">
          Not included: {combined.missing.map((account) => `${account.name} (${account.reason})`).join(", ")}.
        </p>
      )}
      <p className="muted small">
        Estimated by SnapTrade (beta), up to one year back. Includes deposits and withdrawals, so a rise isn't the same
        as a return. Breaks in the line are days with no data.
        {combined?.converted && " Other currencies are converted at today's rate."}
      </p>
    </div>
  );
}

type LineChartProps = {
  points: ValuePoint[]; // At least two, oldest first.
  money: (value: number) => string;
  compactMoney: (value: number) => string; // "CA$165.4K", for the axis.
};

function LineChart({ points, money, compactMoney }: LineChartProps) {
  // Which point the pointer is over, for the crosshair and tooltip. null when it's off the chart.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A little room above and below, so the line doesn't touch the edges. Not from zero:
  // for a trend over time, the change matters more than the distance from $0.
  const padding = (high - low) * 0.1 || Math.abs(high) * 0.05 || 1;
  const yMin = low - padding;
  const yMax = high + padding;

  // Grid lines at the lowest value, halfway, and the highest.
  const gridValues = [0, 0.5, 1].map((fraction) => low + (high - low) * fraction);
  // The left margin fits the longest axis label. A fixed 72 cut off "CA$165.4K".
  // About 9.5 units per character at the axis's 16-unit font, plus a gap before the line.
  const longestLabel = Math.max(...gridValues.map((value) => compactMoney(value).length));
  const leftMargin = Math.max(MARGIN.left, Math.ceil(longestLabel * 9.5) + 14);

  // Turn a date and a value into a position on the chart. y is flipped: SVG counts down from the top.
  const firstTime = Date.parse(points[0].date);
  const timeSpan = Date.parse(points[points.length - 1].date) - firstTime || 1;
  const xFor = (date: string) => leftMargin + ((Date.parse(date) - firstTime) / timeSpan) * (WIDTH - leftMargin - MARGIN.right);
  const yFor = (value: number) =>
    MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * (HEIGHT - MARGIN.top - MARGIN.bottom);
  const dateLabels = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const hovered = hoverIndex === null ? null : points[hoverIndex];

  // Finds the point nearest the pointer, measured along the date axis.
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    // getBoundingClientRect is the chart's size and place on screen, in real pixels.
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    // The pointer's position, converted from screen pixels to the chart's own units.
    const pointerX = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(xFor(point.date) - pointerX) < Math.abs(xFor(points[nearest].date) - pointerX)) nearest = index;
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="line-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Account value from ${money(points[0].value)} on ${formatDayMonth(points[0].date)} to ${money(points[points.length - 1].value)} on ${formatDayMonth(points[points.length - 1].date)}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line className="grid" x1={leftMargin} x2={WIDTH - MARGIN.right} y1={yFor(value)} y2={yFor(value)} />
            <text className="axis" x={leftMargin - 8} y={yFor(value)} textAnchor="end" dominantBaseline="middle">
              {compactMoney(value)}
            </text>
          </g>
        ))}
        {dateLabels.map((point, index) => (
          <text
            key={`${point.date}-${index}`}
            className="axis"
            x={xFor(point.date)}
            y={HEIGHT - 6}
            textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
          >
            {formatMonthYear(point.date)}
          </text>
        ))}
        {/* One line per run of days with data; a lone day is a dot. Gaps stay visible. */}
        {splitAtGaps(points).map((run) =>
          run.length === 1 ? (
            <circle key={run[0].date} className="series-dot" cx={xFor(run[0].date)} cy={yFor(run[0].value)} r={2.5} />
          ) : (
            <polyline
              key={run[0].date}
              className="series-line"
              points={run.map((point) => `${xFor(point.date)},${yFor(point.value)}`).join(" ")}
            />
          ),
        )}
        {hovered && (
          <g>
            <line className="crosshair" x1={xFor(hovered.date)} x2={xFor(hovered.date)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
            <circle className="hover-dot" cx={xFor(hovered.date)} cy={yFor(hovered.value)} r={4} />
          </g>
        )}
      </svg>
      {hovered && (
        <div
          className="tooltip small"
          style={{ left: `${(xFor(hovered.date) / WIDTH) * 100}%` }}
          role="status"
        >
          <strong>{money(hovered.value)}</strong>
          <div className="muted">{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  );
}
