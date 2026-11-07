// CSV downloads for the company table, the funds and the fund overlap: the exact
// numbers behind each card, for a spreadsheet. Pure functions that return text, so
// they can be tested. The download itself happens in app/dashboard/DownloadCsv.tsx.
//
// These are for the person themselves, so they have exact amounts. Like the share
// card, they never include account names or cash.
import type { LookThroughResult } from "./lookthrough";

// A cell with a comma, quote or line break must be quoted, and quotes doubled, or the
// columns shift: "Apple, Inc." would split into two cells.
function cell(value: string | number): string {
  const text = typeof value === "number" ? String(Math.round(value * 100) / 100) : value;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\n") + "\n";
}

// Shares as percentages with two decimals, like 8.41, so a spreadsheet can sort them.
const percent = (fraction: number) => Math.round(fraction * 10000) / 100;

// Every company, with what comes through each fund in its own column.
export function companiesCsv(result: LookThroughResult): string {
  const funds = result.funds.map((fund) => fund.symbol);
  const money = (label: string) => `${label} (${result.currency})`;
  const header = ["Company", "Ticker", money("Total"), money("Bought directly"), money("Through funds"), "% of holdings", ...funds.map(money)];
  const rows = result.companies.map((company) => [
    company.name,
    company.symbol,
    company.total,
    company.direct,
    company.throughFunds,
    percent(company.percent),
    ...funds.map((symbol) => company.byFund.find((entry) => entry.symbol === symbol)?.value ?? 0),
  ]);
  return toCsv([header, ...rows]);
}

export function fundsCsv(result: LookThroughResult): string {
  const total = result.funds.reduce((sum, fund) => sum + fund.value, 0);
  const header = ["Fund", "Name", `Value (${result.currency})`, "% of your funds", "% matched to companies", "Holdings as of", "Uses the holdings of"];
  const rows = result.funds.map((fund) => [
    fund.symbol,
    fund.name,
    fund.value,
    percent(total ? fund.value / total : 0),
    percent(1 - fund.otherWeight - fund.unopenedWeight),
    fund.asOf,
    fund.approximatedBy ?? "",
  ]);
  return toCsv([header, ...rows]);
}

export function overlapsCsv(result: LookThroughResult): string {
  const header = ["Fund", "Fund", "Overlap %", "How it's measured", "Biggest shared companies"];
  const rows = result.overlaps.map((overlap) => [
    overlap.fundA,
    overlap.fundB,
    percent(overlap.sharedWeight),
    overlap.basis === "same-list" ? "Same index" : "Sum of the smaller weight of each shared company",
    overlap.sharedCompanies.slice(0, 5).join("; "),
  ]);
  return toCsv([header, ...rows]);
}
