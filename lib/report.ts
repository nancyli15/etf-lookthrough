// Prepares everything the look-through screen shows from the /api/raw response.
// No UI here, so the wording and the failure handling can be tested directly.
import { toHoldings } from "./holdings";
import { lookThrough, type CompanyExposure, type LookThroughResult } from "./lookthrough";

export type AccountData = {
  account?: { name?: string };
  positions: { ok: boolean; status: number; data: unknown };
};

export type Report = {
  result: LookThroughResult;
  headline?: string;
  skipped: string[]; // Positions we couldn't value.
  failedAccounts: string[]; // Accounts whose positions didn't load, so the totals are short.
  holdingsAsOf?: string;
};

// Fund files shout: "APPLE INC" reads better as "Apple Inc". Names already in
// mixed case, from SnapTrade or our own groups, are left as they are.
export function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/ \+ /g, " & ") // SPDR's file writes "ELI LILLY + CO".
    .replace(/(^|[ &])([a-z])/g, (_, before, letter) => before + letter.toUpperCase());
}

// Below this share, an unopened fund barely moves the numbers. Above it, a company's
// total could be noticeably understated, so the screen says so up front.
const UNOPENED_WARNING_ABOVE = 0.05;

export function hasLargeGap(result: LookThroughResult): boolean {
  const unopened = result.insideUnopenedFunds.reduce((sum, u) => sum + u.value, 0);
  return result.total > 0 && unopened / result.total > UNOPENED_WARNING_ABOVE;
}

export function percentText(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

// Leads with the most surprising fact: the largest company you own in more than one way.
export function headlineFor(companies: CompanyExposure[]): string | undefined {
  const company = companies.find((c) => c.direct > 0 && c.viaFunds.length > 0) ?? companies[0];
  if (!company) return undefined;

  const count = company.viaFunds.length;
  const funds = `${count} ${count === 1 ? "fund" : "funds"}`;
  const how =
    company.direct > 0 && count > 0
      ? `directly and through ${funds}`
      : count > 0
        ? `through ${funds}`
        : "directly";
  return `You own ${displayName(company.name)} ${how}: ${percentText(company.percent)} of your portfolio.`;
}

// With several accounts, the oldest date is the honest one for the whole page.
function oldestAsOf(responses: unknown[]): string | undefined {
  const dates = responses
    .map((r) => (r as { data_freshness?: { as_of?: unknown } })?.data_freshness?.as_of)
    .filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

export function buildReport(accounts: AccountData[]): Report {
  const loaded = accounts.filter((a) => a.positions.ok);
  const responses = loaded.map((a) => a.positions.data);
  const { holdings, skipped } = toHoldings(responses);
  const result = lookThrough(holdings);

  return {
    result,
    headline: headlineFor(result.companies),
    skipped,
    failedAccounts: accounts.filter((a) => !a.positions.ok).map((a) => a.account?.name ?? "An account"),
    holdingsAsOf: oldestAsOf(responses),
  };
}
