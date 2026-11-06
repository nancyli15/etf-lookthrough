// Prepares everything the look-through screen shows from the /api/raw response.
// No UI here, so the wording and the failure handling can be tested directly.
import { FX } from "../data/fx";
import { toHoldings, toNumber } from "./holdings";
import { convertCurrency, lookThrough, type CompanyExposure, type LookThroughResult } from "./lookthrough";
import { shortName } from "./names";

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

// Below this share, an unopened fund barely moves the numbers. Above it, a company's
// total could be noticeably understated, so the screen says so up front.
const UNOPENED_WARNING_ABOVE = 0.05;

// Prices can move between API calls, so a small difference isn't a real disagreement.
const TOTAL_MISMATCH_ABOVE = 0.01;

export function hasLargeGap(result: LookThroughResult): boolean {
  const unopened = result.insideUnopenedFunds.reduce((sum, unopenedFund) => sum + unopenedFund.value, 0);
  return result.total > 0 && unopened / result.total > UNOPENED_WARNING_ABOVE;
}

export function percentText(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function listOf(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

const SHARED_COMPANIES = 5;

// Text for the Share button. Percentages only: no dollar amounts, account names
// or net worth, because people share this with friends and on social media.
export function shareText(result: LookThroughResult): string | undefined {
  const top = result.companies.slice(0, SHARED_COMPANIES);
  if (top.length === 0) return undefined;
  const lines = top.map((company, index) => `${index + 1}. ${shortName(company.name)}: ${percentText(company.percent)}`);
  const funds = result.funds.map((fund) => fund.symbol);
  const opening = funds.length
    ? `I looked inside my funds (${listOf(funds)}). My biggest companies, counting what I own through them:`
    : "My biggest companies:";
  return [opening, ...lines].join("\n");
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
