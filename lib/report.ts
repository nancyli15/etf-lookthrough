// Prepares everything the look-through screen shows from the /api/raw response.
// No UI here, so the wording and the failure handling can be tested directly.
import { FX } from "../data/fx";
import { toHoldings, toNumber } from "./holdings";
import { convertCurrency } from "./currency";
import { hasLargeGap, listOf, percentText, shareText } from "./format";
import { lookThrough, type CompanyExposure, type LookThroughResult } from "./lookthrough";
import { shortName } from "./names";

// Re-exported so existing imports keep working. Browser code imports lib/format.ts.
export { hasLargeGap, percentText, shareText };

export type AccountData = {
  account?: { name?: string; balance?: { total?: { amount?: unknown; currency?: unknown } } };
  positions: { ok: boolean; status: number; data: unknown };
  balances?: { ok: boolean; data: unknown };
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
  holdingsAsOf?: string;
  cash: number; // In the report's currency.
  cashNotLoaded: string[]; // Accounts whose balances didn't load, so net worth is short.
  cashUnconverted: string[]; // Currencies of cash we have no exchange rate for.
  netWorth: number;
  brokerageTotal?: number; // SnapTrade's own account totals, when every account reports one.
  differsFromBrokerage: boolean; // Our total and SnapTrade's disagree by more than timing could explain.
};

// Prices can move between API calls, so a small difference isn't a real disagreement.
const TOTAL_MISMATCH_ABOVE = 0.01;

// Answers "what's my biggest company, and why might that surprise me?"
// Companies arrive largest first, so the first one is the biggest overall.
export function headlineFor(companies: CompanyExposure[]): Headline | undefined {
  const company = companies[0];
  if (!company) return undefined;

  const funds = listOf(company.viaFunds);
  const title = `${shortName(company.name)} is your biggest company, at ${percentText(company.percent)} of your holdings.`;
  if (company.direct > 0 && funds) {
    return {
      title,
      detail: `You own it directly and through ${funds}, so it's a bigger part of your money than your brokerage's list suggests.`,
    };
  }
  if (funds) {
    return { title, detail: `You own it only through ${funds}, so it doesn't appear on your brokerage's list.` };
  }
  return { title, detail: "You own it directly, and none of the funds we can see hold it." };
}

// With several accounts, the oldest date is the honest one for the whole page.
function oldestAsOf(responses: unknown[]): string | undefined {
  const dates = responses
    .map((response) => (response as { data_freshness?: { as_of?: unknown } })?.data_freshness?.as_of)
    .filter((date): date is string => typeof date === "string" && !Number.isNaN(Date.parse(date)));
  return dates.sort((earlier, later) => Date.parse(earlier) - Date.parse(later))[0];
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
      cashNotLoaded.push(accountData.account?.name ?? "An account");
      continue;
    }
    const rows = Array.isArray(accountData.balances.data) ? accountData.balances.data : [];
    for (const row of rows) {
      const amount = toNumber(row?.cash);
      const currency = row?.currency?.code ?? row?.currency;
      if (amount === null || typeof currency !== "string") continue;

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

export function buildReport(accounts: AccountData[]): Report {
  const loaded = accounts.filter((accountData) => accountData.positions.ok);
  const responses = loaded.map((accountData) => accountData.positions.data);
  const { holdings, skipped } = toHoldings(responses);
  const result = lookThrough(holdings);
  const { cash, converted, cashNotLoaded, cashUnconverted } = readCash(accounts, result.currency);
  if (converted) result.fxAsOf = FX.asOf;

  const failedAccounts = accounts
    .filter((accountData) => !accountData.positions.ok)
    .map((accountData) => accountData.account?.name ?? "An account");
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
    holdingsAsOf: oldestAsOf(responses),
    cash,
    cashNotLoaded,
    cashUnconverted,
    netWorth,
    brokerageTotal,
    differsFromBrokerage:
      isComplete &&
      brokerageTotal !== undefined &&
      Math.abs(netWorth - brokerageTotal) > Math.abs(brokerageTotal) * TOTAL_MISMATCH_ABOVE,
  };
}
