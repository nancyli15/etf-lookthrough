// Small helpers the screen uses. They don't import the fund data, so browser code
// can use them without downloading every fund's holdings.
import type { LookThroughResult } from "./lookthrough";
import { shortName } from "./names";

// Below this share, an unopened fund barely moves the numbers. Above it, a company's
// total could be noticeably understated, so the screen says so up front.
const UNOPENED_WARNING_ABOVE = 0.05;

export function hasLargeGap(result: LookThroughResult): boolean {
  const unopened = result.insideUnopenedFunds.reduce((sum, unopenedFund) => sum + unopenedFund.value, 0);
  return result.total > 0 && unopened / result.total > UNOPENED_WARNING_ABOVE;
}

export function percentText(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function listOf(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

