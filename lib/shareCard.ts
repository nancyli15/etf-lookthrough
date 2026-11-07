// Builds the share card as an SVG: one story, "my ETFs own more than you'd think".
// Top to bottom: the biggest company and how much of it comes through funds, the top
// five companies, the biggest overlap between funds, and a line saying what the
// numbers are based on. A pure function that returns text, so it can be tested
// without a browser. The browser turns it into a PNG (see app/dashboard/ShareButton.tsx).
//
// Privacy: no dollar amounts unless the person ticks "Show dollar amounts", and never
// cash, net worth or account names.
import { FX } from "../data/fx";
import { formatMoney, percentText } from "./format";
import type { CompanyExposure, FundOverlap } from "./lookthrough";
import { shortName } from "./names";
import type { Report } from "./report";

// 4:5 portrait, the shape social apps show largest in a feed.
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
// Always the public address, even when shared from a local copy, so it never says "localhost".
export const PUBLIC_HOST = "etf-lookthrough.vercel.app";

const ROWS = 5;
const MARGIN = 80;
const WIDTH = CARD_WIDTH - MARGIN * 2; // Every line has to fit in this.
const COLORS = {
  page: "#f8f9fb",
  tile: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#0e7c86",
  direct: "#2a78d6",
  funds: "#eb6834",
};

export type ShareOptions = {
  amounts?: boolean; // Dollar amounts. Off by default.
  insight?: boolean; // The biggest company, and how much more you own than your shares. On by default.
  overlap?: boolean; // The biggest overlap between two funds. On by default.
};

// Company names come from outside data, and "AT&T" or "<" would break the SVG.
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// SVG text doesn't wrap or shrink, so anything too long is cut with "…" instead of
// running off the edge. An average letter is about 0.55 of the font size wide, a bold one 0.6.
function fitWidth(text: string, fontSize: number, width: number, bold = false): string {
  const max = Math.floor(width / (fontSize * (bold ? 0.6 : 0.55)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function text(x: number, y: number, size: number, content: string, extra = ""): string {
  return `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeXml(content)}</text>`;
}

// A bar whose whole length is the company's total, split into what you bought (blue)
// and what's inside your funds (orange), with a 4px gap, like the table on the page.
function splitBar(company: CompanyExposure, largest: number, x: number, y: number, width: number, height: number): string {
  const directWidth = (company.direct / largest) * width;
  const fundsWidth = (company.throughFunds / largest) * width;
  const gap = directWidth > 0 && fundsWidth > 0 ? 4 : 0;
  return [
    directWidth > 0 && `<rect x="${x}" y="${y}" width="${directWidth.toFixed(1)}" height="${height}" rx="5" fill="${COLORS.direct}"/>`,
    fundsWidth > 0 &&
      `<rect x="${(x + directWidth + gap).toFixed(1)}" y="${y}" width="${Math.max(fundsWidth - gap, 2).toFixed(1)}" height="${height}" rx="5" fill="${COLORS.funds}"/>`,
  ]
    .filter(Boolean)
    .join("");
}

function monthYear(date: string | undefined): string {
  if (!date || Number.isNaN(Date.parse(date))) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

function shortDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function overlapSentence(overlap: FundOverlap): string {
  // Facts about the funds, not a verdict: holding both isn't "wrong".
  return overlap.basis === "same-list"
    ? "They track the same index, so they hold the same companies."
    : `${percentText(overlap.sharedWeight)} of each fund's money is in the same companies.`;
}

export function shareCardSvg(report: Report, options: ShareOptions = {}): string | undefined {
  const { result } = report;
  const top = result.companies.slice(0, ROWS);
  if (top.length === 0) return undefined;
  const amounts = options.amounts === true;
  const money = (value: number) => formatMoney(value, result.currency, { compact: true });
  const parts: string[] = [];

  // Header: the product, and when the holdings are from.
  parts.push(
    text(MARGIN, 96, 24, "ETF LOOK-THROUGH", `font-weight="700" letter-spacing="3" fill="${COLORS.accent}"`),
    text(CARD_WIDTH - MARGIN, 96, 24, monthYear(report.holdingsAsOf ?? result.funds[0]?.asOf), `text-anchor="end" fill="${COLORS.muted}"`),
    text(MARGIN, 186, 64, "My ETFs own more", `font-weight="800" fill="${COLORS.text}"`),
    text(MARGIN, 260, 64, "than you'd think.", `font-weight="800" fill="${COLORS.text}"`),
    text(MARGIN, 312, 28, "My real company exposure, counting the stocks inside my funds.", `fill="${COLORS.muted}"`),
  );
  let y = 360;

  // The biggest company, and what looking through found about it. Only when funds add
  // something: a company you only bought yourself is already on your brokerage's list.
  const biggest = top[0];
  if (options.insight !== false && biggest.throughFunds > 0) {
    const height = 250;
    const share = (value: number) => percentText(biggest.total ? value / biggest.total : 0);
    const split = amounts
      ? `${money(biggest.direct)} bought directly · ${money(biggest.throughFunds)} through funds`
      : `${share(biggest.direct)} bought directly · ${share(biggest.throughFunds)} through funds`;
    const finding =
      biggest.direct > 0
        ? `+${Math.round((biggest.throughFunds / biggest.direct) * 100)}% more than my own shares`
        : "All of it through my funds, not on my brokerage's list";
    parts.push(
      `<rect x="${MARGIN}" y="${y}" width="${WIDTH}" height="${height}" rx="20" fill="${COLORS.tile}" stroke="${COLORS.border}" stroke-width="2"/>`,
      text(MARGIN + 32, y + 50, 22, "MY LARGEST EXPOSURE", `font-weight="700" letter-spacing="2" fill="${COLORS.muted}"`),
      text(MARGIN + 32, y + 112, 52, fitWidth(shortName(biggest.name), 52, WIDTH - 320, true), `font-weight="800" fill="${COLORS.text}"`),
      text(MARGIN + WIDTH - 32, y + 112, 64, percentText(biggest.percent), `font-weight="800" text-anchor="end" fill="${COLORS.accent}"`),
      splitBar(biggest, biggest.total, MARGIN + 32, y + 138, WIDTH - 64, 16),
      text(MARGIN + 32, y + 192, 26, fitWidth(split, 26, WIDTH - 64), `fill="${COLORS.muted}"`),
      text(MARGIN + 32, y + 228, 28, finding, `font-weight="700" fill="${COLORS.text}"`),
    );
    y += height + 56;
  } else {
    y += 20;
  }

  // The top five, each bar as long as the company's total, split by where it comes from.
  parts.push(text(MARGIN, y, 22, "MY TOP 5 COMPANIES · % OF INVESTED HOLDINGS", `font-weight="700" letter-spacing="2" fill="${COLORS.muted}"`));
  const legendX = CARD_WIDTH - MARGIN;
  parts.push(
    `<rect x="${legendX - 330}" y="${y + 22}" width="18" height="18" rx="4" fill="${COLORS.direct}"/>`,
    text(legendX - 304, y + 38, 22, "Direct", `fill="${COLORS.muted}"`),
    `<rect x="${legendX - 210}" y="${y + 22}" width="18" height="18" rx="4" fill="${COLORS.funds}"/>`,
    text(legendX - 184, y + 38, 22, "Through funds", `fill="${COLORS.muted}"`),
  );
  y += 86;
  const largest = top[0].total || 1;
  for (const company of top) {
    const right = amounts ? `${money(company.total)} · ${percentText(company.percent)}` : percentText(company.percent);
    const rightWidth = right.length * 30 * 0.6;
    parts.push(
      text(MARGIN, y, 30, fitWidth(shortName(company.name), 30, WIDTH - rightWidth - 24, true), `font-weight="600" fill="${COLORS.text}"`),
      text(CARD_WIDTH - MARGIN, y, 30, right, `font-weight="700" text-anchor="end" fill="${COLORS.text}"`),
      splitBar(company, largest, MARGIN, y + 14, WIDTH, 12),
    );
    y += 64;
  }

  // The biggest overlap between two of your funds.
  const overlap = result.overlaps[0];
  if (options.overlap !== false && overlap) {
    y += 24;
    const percent = overlap.basis === "same-list" ? "~100%" : percentText(overlap.sharedWeight);
    parts.push(
      `<line x1="${MARGIN}" x2="${CARD_WIDTH - MARGIN}" y1="${y - 40}" y2="${y - 40}" stroke="${COLORS.border}" stroke-width="2"/>`,
      text(MARGIN, y, 22, "MY BIGGEST ETF OVERLAP", `font-weight="700" letter-spacing="2" fill="${COLORS.muted}"`),
      text(MARGIN, y + 52, 40, `${overlap.fundA} + ${overlap.fundB}`, `font-weight="800" fill="${COLORS.text}"`),
      text(CARD_WIDTH - MARGIN, y + 52, 40, percent, `font-weight="800" text-anchor="end" fill="${COLORS.accent}"`),
      text(MARGIN, y + 92, 26, fitWidth(overlapSentence(overlap), 26, WIDTH), `fill="${COLORS.muted}"`),
    );
  }

  // What the numbers are based on, so they can be read correctly. Two short lines,
  // so the dates and the exchange rate are never cut off.
  const fundDate = result.funds[0]?.asOf;
  const counted = `${result.companies.length.toLocaleString("en-US")} underlying companies · cash not included`;
  const dated = [
    report.holdingsAsOf && `Holdings ${shortDate(report.holdingsAsOf)}`,
    fundDate && `fund data ${shortDate(fundDate)}`,
    result.fxAsOf && `US$1 = CA$${FX.cadPerUsd}`,
  ]
    .filter(Boolean)
    .join(" · ");
  parts.push(
    text(MARGIN, CARD_HEIGHT - 116, 20, fitWidth(counted, 20, WIDTH), `fill="${COLORS.muted}"`),
    text(MARGIN, CARD_HEIGHT - 88, 20, fitWidth(dated, 20, WIDTH), `fill="${COLORS.muted}"`),
    text(MARGIN, CARD_HEIGHT - 48, 24, PUBLIC_HOST, `font-weight="700" fill="${COLORS.accent}"`),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${COLORS.page}"/>
  <rect x="0" y="0" width="${CARD_WIDTH}" height="12" fill="${COLORS.accent}"/>
  ${parts.join("\n  ")}
</svg>`;
}
