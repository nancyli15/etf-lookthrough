"use client";
// Line chart of total account value over the past year, from SnapTrade's beta
// /balanceHistory endpoint (through /api/history). It loads on its own, so if the
// beta fails, only this card shows an error.
//
// Only mounted after /api/raw has finished, so any token refresh from that call is
// already saved. Two calls refreshing at once would reuse a single-use refresh token
// and sign the user out.
import { useEffect, useMemo, useRef, useState } from "react";
import { combineHistory, splitAtGaps, type HistoryResponse, type ValuePoint } from "../../lib/history";

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 30, left: 72 };

type Props = {
  currency: string;
  money: (value: number) => string;
};

function shortDate(date: string, withYear = false): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: withYear ? undefined : "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export default function AccountValueChart({ currency, money }: Props) {
  const [responses, setResponses] = useState<HistoryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/api/history")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        setResponses((await response.json()).accounts ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "unknown error"));
  }, []);

  const history = useMemo(() => (responses ? combineHistory(responses, currency) : null), [responses, currency]);

  const compactMoney = (value: number) =>
    value.toLocaleString(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });

  let body: React.ReactNode;
  if (error) {
    body = <p className="error small">Couldn't load account history ({error}). The rest of the page isn't affected.</p>;
  } else if (!history) {
    body = <p className="muted small">Loading account history…</p>;
  } else if (history.points.length < 2) {
    body = (
      <p className="muted small">
        No history to chart yet. SnapTrade says new accounts can take up to a day to get history.
      </p>
    );
  } else {
    body = (
      <LineChart
        points={history.points}
        hoverIndex={hoverIndex}
        setHoverIndex={setHoverIndex}
        svgRef={svgRef}
        money={money}
        compactMoney={compactMoney}
      />
    );
  }

  const latest = history?.points[history.points.length - 1];

  return (
    <div className="card">
      <h2>Account value</h2>
      {body}
      {latest && history && history.points.length >= 2 && (
        <p className="small spaced">
          Latest estimate: <strong>{money(latest.value)}</strong> on {shortDate(latest.date, false)}
        </p>
      )}
      {history && history.missing.length > 0 && (
        <p className="error small">
          Not included: {history.missing.map((account) => `${account.name} (${account.reason})`).join(", ")}.
        </p>
      )}
      <p className="muted small">
        Estimated by SnapTrade (beta), up to one year back. Includes deposits and withdrawals, so a rise isn't the same
        as a return. Breaks in the line are days with no data.
        {history?.converted && " Other currencies are converted at today's rate."}
      </p>
    </div>
  );
}

type LineChartProps = {
  points: ValuePoint[];
  hoverIndex: number | null;
  setHoverIndex: (index: number | null) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  money: (value: number) => string;
  compactMoney: (value: number) => string;
};

function LineChart({ points, hoverIndex, setHoverIndex, svgRef, money, compactMoney }: LineChartProps) {
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A little room above and below, so the line doesn't touch the edges. Not from zero:
  // for a trend over time, the change matters more than the distance from $0.
  const padding = (high - low) * 0.1 || Math.abs(high) * 0.05 || 1;
  const yMin = low - padding;
  const yMax = high + padding;

  const firstTime = Date.parse(points[0].date);
  const span = Date.parse(points[points.length - 1].date) - firstTime || 1;
  const x = (date: string) => PAD.left + ((Date.parse(date) - firstTime) / span) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * (HEIGHT - PAD.top - PAD.bottom);

  const gridValues = [0, 0.5, 1].map((share) => low + (high - low) * share);
  const dateLabels = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const hovered = hoverIndex === null ? null : points[hoverIndex];

  // Finds the point nearest the pointer, measured along the date axis.
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const pointerX = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(x(point.date) - pointerX) < Math.abs(x(points[nearest].date) - pointerX)) nearest = index;
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="line-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Account value from ${money(points[0].value)} on ${shortDate(points[0].date, false)} to ${money(points[points.length - 1].value)} on ${shortDate(points[points.length - 1].date, false)}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="axis" x={PAD.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle">
              {compactMoney(value)}
            </text>
          </g>
        ))}
        {dateLabels.map((point, index) => (
          <text
            key={`${point.date}-${index}`}
            className="axis"
            x={x(point.date)}
            y={HEIGHT - 6}
            textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
          >
            {shortDate(point.date, true)}
          </text>
        ))}
        {splitAtGaps(points).map((run) =>
          run.length === 1 ? (
            <circle key={run[0].date} className="series-dot" cx={x(run[0].date)} cy={y(run[0].value)} r={2.5} />
          ) : (
            <polyline
              key={run[0].date}
              className="series-line"
              points={run.map((point) => `${x(point.date)},${y(point.value)}`).join(" ")}
            />
          ),
        )}
        {hovered && (
          <g>
            <line className="crosshair" x1={x(hovered.date)} x2={x(hovered.date)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
            <circle className="hover-dot" cx={x(hovered.date)} cy={y(hovered.value)} r={4} />
          </g>
        )}
      </svg>
      {hovered && (
        <div
          className="tooltip small"
          style={{ left: `${(x(hovered.date) / WIDTH) * 100}%` }}
          role="status"
        >
          <strong>{money(hovered.value)}</strong>
          <div className="muted">{shortDate(hovered.date, false)}, {new Date(hovered.date).getUTCFullYear()}</div>
        </div>
      )}
    </div>
  );
}
