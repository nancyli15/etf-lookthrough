// Builds the share image as an SVG: your top companies as bars, percentages only.
// A pure function that returns text, so it can be tested without a browser. The
// browser turns it into a PNG (see app/dashboard/ShareButton.tsx).
//
// Privacy: like shareText, no dollar amounts, net worth or account names.
import type { LookThroughResult } from "./lookthrough";
import { shortName } from "./names";
import { percentText } from "./format";

export const CARD_SIZE = 1080; // Square, so it fits chats, posts and stories.

const ROWS = 5;
const MARGIN = 88;
const ROW_HEIGHT = 118;
const BAR_HEIGHT = 22;
const COLORS = {
  page: "#f8f9fb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#0e7c86",
  direct: "#2a78d6",
  funds: "#eb6834",
};

// Company names come from outside data, and "AT&T" or "<" would break the SVG.
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fit(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function shareCardSvg(result: LookThroughResult, siteUrl: string): string | undefined {
  const top = result.companies.slice(0, ROWS);
  if (top.length === 0) return undefined;

  const funds = result.funds.map((fund) => fund.symbol);
  const subtitle = funds.length
    ? `My biggest companies, counting what's inside ${fit(funds.join(", "), 40)}`
    : "My biggest companies";
  const barWidth = CARD_SIZE - MARGIN * 2;
  // Bars are scaled to the biggest company, like the chart on the page.
  const largest = top[0].total || 1;
  const hasDirect = top.some((company) => company.direct > 0);
  const hasFunds = top.some((company) => company.throughFunds > 0);

  const rows = top
    .map((company, index) => {
      const y = 300 + index * ROW_HEIGHT;
      const directWidth = (company.direct / largest) * barWidth;
      const fundsWidth = (company.throughFunds / largest) * barWidth;
      // 4px gap between the two parts, as on the page.
      const gap = directWidth > 0 && fundsWidth > 0 ? 4 : 0;
      return [
        `<text x="${MARGIN}" y="${y}" font-size="40" font-weight="600" fill="${COLORS.text}">${escapeXml(fit(shortName(company.name), 28))}</text>`,
        `<text x="${CARD_SIZE - MARGIN}" y="${y}" font-size="40" font-weight="600" fill="${COLORS.text}" text-anchor="end">${percentText(company.percent)}</text>`,
        directWidth > 0 &&
          `<rect x="${MARGIN}" y="${y + 22}" width="${directWidth.toFixed(1)}" height="${BAR_HEIGHT}" rx="6" fill="${COLORS.direct}"/>`,
        fundsWidth > 0 &&
          `<rect x="${(MARGIN + directWidth + gap).toFixed(1)}" y="${y + 22}" width="${Math.max(fundsWidth - gap, 2).toFixed(1)}" height="${BAR_HEIGHT}" rx="6" fill="${COLORS.funds}"/>`,
      ]
        .filter(Boolean)
        .join("\n  ");
    })
    .join("\n  ");

  const legendY = 300 + ROWS * ROW_HEIGHT + 10;
  const legend =
    hasDirect && hasFunds
      ? [
          `<rect x="${MARGIN}" y="${legendY - 22}" width="24" height="24" rx="5" fill="${COLORS.direct}"/>`,
          `<text x="${MARGIN + 36}" y="${legendY}" font-size="28" fill="${COLORS.muted}">Bought directly</text>`,
          `<rect x="${MARGIN + 290}" y="${legendY - 22}" width="24" height="24" rx="5" fill="${COLORS.funds}"/>`,
          `<text x="${MARGIN + 326}" y="${legendY}" font-size="28" fill="${COLORS.muted}">Through funds</text>`,
        ].join("\n  ")
      : "";

  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_SIZE}" height="${CARD_SIZE}" viewBox="0 0 ${CARD_SIZE} ${CARD_SIZE}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
  <rect width="${CARD_SIZE}" height="${CARD_SIZE}" fill="${COLORS.page}"/>
  <rect x="0" y="0" width="${CARD_SIZE}" height="12" fill="${COLORS.accent}"/>
  <text x="${MARGIN}" y="150" font-size="68" font-weight="700" fill="${COLORS.text}">What I actually own</text>
  <text x="${MARGIN}" y="210" font-size="32" fill="${COLORS.muted}">${escapeXml(subtitle)}</text>
  ${rows}
  ${legend}
  <text x="${MARGIN}" y="${CARD_SIZE - 70}" font-size="28" fill="${COLORS.muted}">Share of my holdings, cash not included</text>
  <text x="${CARD_SIZE - MARGIN}" y="${CARD_SIZE - 70}" font-size="28" font-weight="600" fill="${COLORS.accent}" text-anchor="end">${escapeXml(host)}</text>
</svg>`;
}
