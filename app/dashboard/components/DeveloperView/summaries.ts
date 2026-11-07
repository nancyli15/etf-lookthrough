// Short descriptions of each SnapTrade response, so a Developer view row says
// what came back without being opened.
import { activityRowsOf } from "@/lib/portfolio/activities/activities";
import { positionsOf } from "@/lib/portfolio/holdings/holdings";
import type { Report } from "@/lib/analysis/report/report";

export const COMPANIES_SHOWN = 10; // The report row shows only the first few: the full list can be thousands.

export type CallName = "positions" | "balances" | "activities" | "history";

// "12 positions", "2 currencies", "365 days, in CAD".
export function summaryOf(name: CallName, data: unknown): string {
  if (name === "positions") return countOf(positionsOf(data).length, "position");
  if (name === "balances") return countOf(Array.isArray(data) ? data.length : 0, "currency", "currencies");
  if (name === "history") {
    const body = data as { history?: unknown; currency?: unknown };
    const days = Array.isArray(body?.history) ? body.history.length : 0;
    return `${countOf(days, "day")}${typeof body?.currency === "string" ? `, in ${body.currency}` : ""}`;
  }
  return countOf(activityRowsOf(data).length, "activity", "activities");
}

// "1 call", "4 calls", "1,204 companies".
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

// The report's headline numbers, plus the first few companies. The full report
// can hold thousands of companies, which would make this row slow to open.
export function reportSummary(report: Report) {
  const { result } = report;
  return {
    currency: result.currency,
    netWorth: report.netWorth,
    holdings: result.total,
    cash: report.cash,
    snapTradeTotal: report.brokerageTotal,
    differsFromSnapTrade: report.differsFromBrokerage,
    companies: result.companies.length,
    [`first${COMPANIES_SHOWN}Companies`]: result.companies.slice(0, COMPANIES_SHOWN).map((company) => ({
      symbol: company.symbol,
      total: company.total,
      direct: company.direct,
      byFund: company.byFund,
      percent: company.percent,
    })),
    funds: result.funds,
    otherInFunds: result.otherInFunds,
    insideUnopenedFunds: result.insideUnopenedFunds,
    notLookedThrough: result.notLookedThrough,
    skipped: report.skipped,
    failedAccounts: report.failedAccounts,
    activitySince: report.activitySince,
    fxAsOf: result.fxAsOf,
  };
}
