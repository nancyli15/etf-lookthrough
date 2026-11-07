// Short descriptions of each SnapTrade response, so a Developer view row says
// what came back without being opened.
import { positionsOf } from "@/lib/portfolio/holdings/holdings";
import type { Report } from "@/lib/analysis/report/report";

export const COMPANIES_SHOWN = 10; // The report row shows only the first few: the full list can be thousands.

// A short summary of each response, so the row says what came back without opening it.
export function summaryOf(name: string, data: unknown): string {
  if (name === "positions") return countOf(positionsOf(data).length, "position");
  if (name === "balances") return countOf(Array.isArray(data) ? data.length : 0, "currency", "currencies");
  if (name === "history") {
    const body = data as { history?: unknown; currency?: unknown };
    const days = Array.isArray(body?.history) ? body.history.length : 0;
    return `${countOf(days, "day")}${typeof body?.currency === "string" ? `, in ${body.currency}` : ""}`;
  }
  // /activities wraps its list as { data: [...] }. Accept a bare list too.
  const list = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  return countOf(Array.isArray(list) ? list.length : 0, "activity", "activities");
}

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
