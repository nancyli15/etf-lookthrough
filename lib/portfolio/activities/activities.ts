// Turns /activities responses into each company's recent trades and dividends,
// for the company dropdown. Only your own activity: what a fund buys or sells
// inside itself isn't in here.
import { toNumber } from "../holdings/holdings";

export type Activity = {
  date: string; // YYYY-MM-DD, from trade_date.
  kind: "buy" | "sell" | "dividend" | "reinvested" | "stockDividend";
  units: number; // Shares bought or sold, always positive. 0 for a dividend.
  price: number;
  amount: number; // Cash amount, always positive.
  currency: string;
};

// SnapTrade's activity types we show. Fees, taxes, deposits and the rest aren't
// about the company, so they're left out.
const KINDS: Record<string, Activity["kind"]> = {
  BUY: "buy",
  SELL: "sell",
  DIVIDEND: "dividend",
  REI: "reinvested", // A dividend used to buy more shares.
  STOCK_DIVIDEND: "stockDividend", // A dividend paid in shares instead of cash.
};

export const RECENT_PER_COMPANY = 3;

// /activities wraps its list as { data: [...] }. Accept a bare list too.
function listOf(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  const list = (data as { data?: unknown })?.data;
  return Array.isArray(list) ? list : [];
}

// Keyed by ticker, newest first, at most RECENT_PER_COMPANY each.
export function recentActivity(responses: unknown[]): Record<string, Activity[]> {
  const byTicker: Record<string, Activity[]> = {};
  for (const response of responses) {
    for (const row of listOf(response)) {
      const kind = KINDS[String(row?.type ?? "").toUpperCase()];
      const ticker = row?.symbol?.raw_symbol ?? row?.symbol?.symbol;
      const date = typeof row?.trade_date === "string" ? row.trade_date.slice(0, 10) : "";
      const currency = row?.currency?.code ?? row?.currency;
      if (!kind || typeof ticker !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof currency !== "string") {
        continue;
      }
      // Numbers here arrive as real numbers, but read them the same careful way.
      const activity: Activity = {
        date,
        kind,
        units: Math.abs(toNumber(row.units) ?? 0),
        price: toNumber(row.price) ?? 0,
        amount: Math.abs(toNumber(row.amount) ?? 0),
        currency,
      };
      (byTicker[ticker.toUpperCase()] ??= []).push(activity);
    }
  }
  for (const ticker of Object.keys(byTicker)) {
    byTicker[ticker] = byTicker[ticker].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_PER_COMPANY);
  }
  return byTicker;
}
