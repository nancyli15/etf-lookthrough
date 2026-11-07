// Small helpers the screen uses. They don't import the fund data, so browser code
// can use them without downloading every fund's holdings.
import type { LookThroughResult } from "../../analysis/lookthrough/lookthrough";

// Always "US$" or "CA$", never a bare "$". Browsers write their own country's
// currency as "$", so in Canada CA$ showed as "$" and US$ as "US$", and switching
// accounts looked like the symbol disappeared. Same text on every computer.
const CURRENCY_PREFIX: Record<string, string> = { USD: "US$", CAD: "CA$" };

type MoneyOptions = {
  compact?: boolean; // "CA$165.4K", for the chart's axis and the donut's middle.
  whole?: boolean; // "CA$4,100", for the short line under each bar.
};

export function formatMoney(value: number, currency: string, options: MoneyOptions = {}): string {
  const numberFormat = options.compact
    ? { notation: "compact" as const, maximumFractionDigits: 1 }
    : options.whole
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const digits = Math.abs(value).toLocaleString("en-US", numberFormat);
  const sign = value < 0 ? "-" : "";
  const prefix = CURRENCY_PREFIX[currency];
  // Other currencies are rare here (they're listed as unconverted), so the code is clearest.
  return prefix ? `${sign}${prefix}${digits}` : `${sign}${digits} ${currency}`;
}

// Below this share, an unopened fund barely moves the numbers. Above it, a company's
// total could be noticeably understated, so the screen says so up front.
const UNOPENED_WARNING_ABOVE = 0.05;

// True when enough of the portfolio sits in funds we can't open that company totals
// are noticeably understated.
export function hasLargeGap(result: LookThroughResult): boolean {
  const unopened = sumOf(result.insideUnopenedFunds, (fund) => fund.value);
  return result.total > 0 && unopened / result.total > UNOPENED_WARNING_ABOVE;
}

// Adds up one number from each row: sumOf(funds, (fund) => fund.value).
export function sumOf<T>(rows: T[], valueOf: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + valueOf(row), 0);
}

export function percentText(fraction: number): string {
  // A real but tiny share, like CA$69 of CA$109K, reads as "<0.1%", not a misleading "0.0%".
  if (fraction > 0 && fraction < 0.0005) return "<0.1%";
  return `${(fraction * 100).toFixed(1)}%`;
}

// "SPY", "SPY and XEQT", "SPY, XEQT and XQQ".
export function listOf(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// "Nov 4, 2026". Date-only strings are midnight UTC, which can display as the day
// before locally, so the date is read in UTC.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

// "Nov 4", for dates in a list or on a chart where the year is clear.
export function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// "Nov 2026", for the chart's date axis.
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}
