// Turns /balanceHistory responses from every account into one line of total
// account value over time. No UI here, so the combining rules can be tested.
//
// /balanceHistory is a beta endpoint. SnapTrade's reference says its values are
// estimates that may have gaps, so this reads defensively and reports what it
// couldn't use instead of guessing.
import { rowsIn, type SnapTradeBalanceHistory, type SnapTradeBalanceHistoryDay } from "../../snaptrade/responses/responses";
import { toNumber, toText } from "../holdings/holdings";
import { convertCurrency } from "../currency/currency";

// One account's /balanceHistory result, as packaged by /api/history. The id matches
// the account in /api/raw, so the Developer view can put each response with its account.
export type HistoryResponse = { id?: string; name: string; status: number; ok: boolean; data: unknown };

// /api/history as the page sees it. Dashboard.tsx loads it once and hands it to both
// the chart and the Developer view, so there's no second call.
export type HistoryLoad =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "loaded"; fetchedAt: string; accounts: HistoryResponse[] };

export type ValuePoint = { date: string; value: number }; // date is YYYY-MM-DD.

export type AccountValueHistory = {
  currency: string;
  points: ValuePoint[]; // Oldest first. Only dates every included account reports.
  included: string[]; // Account names that make up the line.
  missing: { name: string; reason: string }[]; // Accounts left out, and why.
  converted: boolean; // True if any account was converted at today's rate.
};

// Markets close on weekends and holidays, so a few days without a point is normal.
// A longer gap means missing data, and the chart shows a break instead of a straight line.
const MAX_GAP_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

// The reference says "date" is a date, but its example is a full timestamp. Accept both.
function dateOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) ? day : null;
}

function reasonFor(response: HistoryResponse): string {
  // 403 is what the reference lists when the add-on isn't turned on.
  if (response.status === 403) return "Balance history isn't turned on for this app";
  return `Didn't load (status ${response.status})`;
}

export function combineHistory(responses: HistoryResponse[], reportCurrency: string): AccountValueHistory {
  const result: AccountValueHistory = { currency: reportCurrency, points: [], included: [], missing: [], converted: false };
  // One map per included account: date → that day's value, in the report's currency.
  const valueByDatePerAccount: Map<string, number>[] = [];

  for (const response of responses) {
    if (!response.ok) {
      result.missing.push({ name: response.name, reason: reasonFor(response) });
      continue;
    }
    const body = response.data as SnapTradeBalanceHistory | null;
    const rows = rowsIn<SnapTradeBalanceHistoryDay>(body?.history);
    const currency = toText(body?.currency) ?? reportCurrency;
    if (convertCurrency(1, currency, reportCurrency) === null) {
      result.missing.push({ name: response.name, reason: `No exchange rate for ${currency}` });
      continue;
    }

    const valueByDate = new Map<string, number>();
    for (const row of rows) {
      const date = dateOf(row?.date);
      const amount = toNumber(row?.total_value); // Sent as a string, like positions.
      if (!date || amount === null) continue;
      // The rate was checked above, so this can't be null.
      valueByDate.set(date, convertCurrency(amount, currency, reportCurrency)!);
    }

    if (valueByDate.size === 0) {
      // New accounts can take up to a day to get history, per SnapTrade's dashboard.
      result.missing.push({ name: response.name, reason: "No history yet" });
      continue;
    }
    if (currency !== reportCurrency) result.converted = true;
    result.included.push(response.name);
    valueByDatePerAccount.push(valueByDate);
  }

  if (valueByDatePerAccount.length === 0) return result;

  // Accounts update on different days: in the Sandbox, Individual's latest value was
  // Nov 5 and the IRA's was Nov 4. Using only dates every account has would end the
  // line on Nov 2, days out of date. So on each date, an account without a value
  // uses its most recent one, up to MAX_GAP_DAYS old. Past that, or before the
  // account's first value, the date is left out: adding a missing account as $0
  // would show a fake drop.
  const dates = [...new Set(valueByDatePerAccount.flatMap((valueByDate) => [...valueByDate.keys()]))].sort();
  for (const date of dates) {
    let total = 0;
    let everyAccountHasValue = true;
    for (const valueByDate of valueByDatePerAccount) {
      const value = latestOnOrBefore(valueByDate, date);
      if (value === undefined) {
        everyAccountHasValue = false;
        break;
      }
      total += value;
    }
    if (everyAccountHasValue) result.points.push({ date, value: total });
  }
  // $0 days at the start are before the account had money in it. They'd stretch the
  // chart down to $0 and make the first deposit look like a huge jump. A $0 later on
  // could be real, so only the leading ones go.
  const firstFunded = result.points.findIndex((point) => point.value !== 0);
  result.points = firstFunded === -1 ? [] : result.points.slice(firstFunded);
  return result;
}

// An account's value on a date, or its most recent one up to MAX_GAP_DAYS earlier.
function latestOnOrBefore(valueByDate: Map<string, number>, date: string): number | undefined {
  if (valueByDate.has(date)) return valueByDate.get(date);
  for (let daysBack = 1; daysBack <= MAX_GAP_DAYS; daysBack++) {
    const earlier = new Date(Date.parse(date) - daysBack * DAY_MS).toISOString().slice(0, 10);
    if (valueByDate.has(earlier)) return valueByDate.get(earlier);
  }
  return undefined;
}

// Splits the points wherever data is missing, so the chart can draw each run
// as its own line and leave the gap visible.
export function splitAtGaps(points: ValuePoint[], maxGapDays = MAX_GAP_DAYS): ValuePoint[][] {
  const runs: ValuePoint[][] = [];
  for (const point of points) {
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (previous && (Date.parse(point.date) - Date.parse(previous.date)) / DAY_MS <= maxGapDays) {
      run.push(point);
    } else {
      runs.push([point]);
    }
  }
  return runs;
}
