// Prepares everything the look-through screen shows from the /api/raw response.
// No UI here, so the wording and the failure handling can be tested directly.
import { FX } from "../../../data/fx";
import { toHoldings, toNumber, toText } from "../../portfolio/holdings/holdings";
import { rowsIn, type SnapTradeAccount, type SnapTradeBalance } from "../../snaptrade/responses/responses";
import { recentActivity, type Activity } from "../../portfolio/activities/activities";
import { convertCurrency, currencyCodeOf } from "../../portfolio/currency/currency";
import { listOf, percentText } from "../../display/format/format";
import { lookThrough, type CompanyExposure, type LookThroughResult } from "../lookthrough/lookthrough";
import { shortName } from "../../display/names/names";

// One account and what SnapTrade answered about it. `data` is each response as sent.
export type AccountData = {
  account?: SnapTradeAccount;
  positions: { ok: boolean; status: number; data: unknown };
  balances?: { ok: boolean; data: unknown };
  activities?: { ok: boolean; data: unknown };
};

export type Headline = {
  title: string;
  detail: string;
};

export type Report = {
  result: LookThroughResult;
  headline?: Headline;
  skipped: string[]; // Positions we couldn't value.
  failedAccounts: string[]; // Accounts whose positions didn't load, so the totals are short.
  holdingsSyncedAt?: string; // The oldest account's last holdings sync, from /accounts.
  cash: number; // In the report's currency.
  cashNotLoaded: string[]; // Accounts whose balances didn't load, so net worth is short.
  cashUnconverted: string[]; // Currencies of cash we have no exchange rate for.
  netWorth: number;
  brokerageTotal?: number; // SnapTrade's own account totals, when every account reports one.
  differsFromBrokerage: boolean; // Our total and SnapTrade's disagree by more than timing could explain.
  recentActivity: Record<string, Activity[]>; // Your latest trades and dividends, by ticker.
  activitySince?: string; // YYYY-MM-DD. Every account's history covers at least this far back.
  activityNotLoaded: string[]; // Accounts whose /activities call failed.
};

// Prices can move between API calls, so a small difference isn't a real disagreement.
const TOTAL_MISMATCH_ABOVE = 0.01;

// For lists of accounts that failed: SnapTrade's name, or a stand-in.
const accountName = (accountData: AccountData) => toText(accountData.account?.name) ?? "An account";

// Answers "what's my biggest company, and why might that surprise me?"
// Companies arrive largest first, so the first one is the biggest overall.
export function headlineFor(companies: CompanyExposure[]): Headline | undefined {
  const company = companies[0];
  if (!company) return undefined;

  const funds = listOf(company.viaFunds);
  const title = `${shortName(company.name)} is your biggest company, at ${percentText(company.percent)} of your holdings.`;
  if (company.direct > 0 && funds) {
    // What look-through found, as one number: how much more you own than your own shares.
    // CA$5,731 bought plus CA$2,866 through funds is 50% more than the shares alone.
    const more = Math.round((company.throughFunds / company.direct) * 100);
    return {
      title,
      detail: `You own it directly and through ${funds}, so you own ${more}% more of it than your shares alone.`,
    };
  }
  if (funds) {
    return { title, detail: `You own it only through ${funds}, so it doesn't appear on your brokerage's list.` };
  }
  return { title, detail: "You own it directly, and none of the funds we can see hold it." };
}

// How far back activity goes, from each account's sync_status. With several
// accounts, the latest start is the honest one: every account covers it. If any
// account doesn't say, there's no date we can promise.
function activitySince(accounts: AccountData[]): string | undefined {
  const starts = accounts.map((accountData) => accountData.account?.sync_status?.transactions?.first_transaction_date);
  if (starts.length === 0 || !starts.every((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date))) {
    return undefined;
  }
  return starts.map((date) => date.slice(0, 10)).sort().at(-1);
}

// When SnapTrade last synced holdings from the brokerage. Not the positions
// response's data_freshness.as_of: in testing that was the moment SnapTrade
// answered, about 10 hours after the last sync. With several accounts, the oldest
// sync is the honest one for the page. If any account doesn't say, we can't promise one.
function holdingsSyncedAt(accounts: AccountData[]): string | undefined {
  const times = accounts.map((accountData) => accountData.account?.sync_status?.holdings?.last_successful_sync);
  if (times.length === 0 || !times.every((time): time is string => typeof time === "string" && !Number.isNaN(Date.parse(time)))) {
    return undefined;
  }
  return times.sort((earlier, later) => Date.parse(earlier) - Date.parse(later))[0];
}

// /balances returns one row per currency: [{ currency: { code }, cash }].
function readCash(accounts: AccountData[], reportCurrency: string) {
  let cash = 0;
  let converted = false;
  const cashNotLoaded: string[] = [];
  const cashUnconverted = new Set<string>();

  for (const accountData of accounts) {
    if (!accountData.balances) continue;
    if (!accountData.balances.ok) {
      cashNotLoaded.push(accountName(accountData));
      continue;
    }
    for (const row of rowsIn<SnapTradeBalance>(accountData.balances.data)) {
      const amount = toNumber(row?.cash);
      const currency = currencyCodeOf(row?.currency);
      if (amount === null || !currency) continue;

      const value = convertCurrency(amount, currency, reportCurrency);
      if (value === null) {
        cashUnconverted.add(currency);
        continue;
      }
      if (currency !== reportCurrency) converted = true;
      cash += value;
    }
  }

  return { cash, converted, cashNotLoaded, cashUnconverted: [...cashUnconverted] };
}

// Partial totals can't be compared with our total, so one missing account means no comparison.
function readBrokerageTotal(accounts: AccountData[], reportCurrency: string): number | undefined {
  if (accounts.length === 0) return undefined;
  let total = 0;
  for (const accountData of accounts) {
    const accountTotal = accountData.account?.balance?.total;
    const amount = toNumber(accountTotal?.amount);
    const currency = accountTotal?.currency;
    if (amount === null || typeof currency !== "string") return undefined;

    const value = convertCurrency(amount, currency, reportCurrency);
    if (value === null) return undefined;
    total += value;
  }
  return total;
}

export type ReportCurrency = "USD" | "CAD";

// The currency to report in, if the user hasn't chosen one with the switch. It
// looks at cash and SnapTrade's account totals as well as holdings: an FHSA with
// only CAD cash used to fall back to USD and get converted for no reason.
function naturalCurrency(accounts: AccountData[], holdingCurrencies: string[]): ReportCurrency {
  const currencies = new Set(holdingCurrencies);
  for (const accountData of accounts) {
    const totalCurrency = toText(accountData.account?.balance?.total?.currency);
    if (totalCurrency) currencies.add(totalCurrency);
    const rows = accountData.balances?.ok ? rowsIn<SnapTradeBalance>(accountData.balances.data) : [];
    for (const row of rows) {
      const code = currencyCodeOf(row?.currency);
      if (code) currencies.add(code);
    }
  }
  // Any Canadian money means a Canadian user, so CAD. Otherwise USD.
  return currencies.has("CAD") ? "CAD" : "USD";
}

export function buildReport(accounts: AccountData[], options: { currency?: ReportCurrency } = {}): Report {
  const positionResponses = accounts
    .filter((accountData) => accountData.positions.ok)
    .map((accountData) => accountData.positions.data);
  const { holdings, skipped } = toHoldings(positionResponses);
  const currency = options.currency ?? naturalCurrency(accounts, holdings.map((holding) => holding.currency));
  const result = lookThrough(holdings, { currency });
  const { cash, converted, cashNotLoaded, cashUnconverted } = readCash(accounts, result.currency);
  if (converted) result.fxAsOf = FX.asOf;

  const failedAccounts = accounts.filter((accountData) => !accountData.positions.ok).map(accountName);
  const netWorth = result.total + cash;
  const brokerageTotal = readBrokerageTotal(accounts, result.currency);
  // Missing data already has its own warning, and would make the totals differ anyway.
  const isComplete =
    failedAccounts.length === 0 &&
    skipped.length === 0 &&
    cashNotLoaded.length === 0 &&
    cashUnconverted.length === 0 &&
    result.unconverted.length === 0;

  return {
    result,
    headline: headlineFor(result.companies),
    skipped,
    failedAccounts,
    holdingsSyncedAt: holdingsSyncedAt(accounts),
    cash,
    cashNotLoaded,
    cashUnconverted,
    netWorth,
    brokerageTotal,
    recentActivity: recentActivity(
      accounts.filter((accountData) => accountData.activities?.ok).map((accountData) => accountData.activities!.data),
    ),
    activitySince: activitySince(accounts),
    activityNotLoaded: accounts.filter((accountData) => accountData.activities && !accountData.activities.ok).map(accountName),
    differsFromBrokerage:
      isComplete &&
      brokerageTotal !== undefined &&
      Math.abs(netWorth - brokerageTotal) > Math.abs(brokerageTotal) * TOTAL_MISMATCH_ABOVE,
  };
}
