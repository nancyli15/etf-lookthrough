// Wording and math for a company's dropdown in the combined table. It answers,
// in order: is that more than I thought, why is it in each fund, what if it
// moves, which part do I control, and what have I done with it lately.
//
// Facts only, never advice: it says what changes a number, not what to do.
// No fund data imported, so the browser can use it.
import type { Activity } from "./activities";
import { percentText } from "./format";
import type { CompanyExposure, FundSummary } from "./lookthrough";
import { shortName } from "./names";

type Money = (value: number, currency?: string) => string;

function units(count: number): string {
  const text = count.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${text} ${count === 1 ? "share" : "shares"}`;
}

// Small weights need more digits: 0.05% would show as 0.1% with one.
export function weightText(weight: number): string {
  if (weight > 0 && weight < 0.0001) return "under 0.01%";
  return `${(weight * 100).toFixed(weight >= 0.1 ? 1 : 2)}%`;
}

// 1. Is that more than I thought? Brokerages list only the shares you bought.
export function ownershipText(company: CompanyExposure, money: Money): string {
  const name = shortName(company.name);
  if (company.direct > 0 && company.throughFunds > 0) {
    const extra = company.direct ? company.throughFunds / company.direct : 0;
    return `Your brokerage shows ${money(company.direct)} (${units(company.directUnits)}). Counting your funds, you own ${money(company.total)}, which is ${percentText(extra)} more.`;
  }
  if (company.direct > 0) {
    return `You own ${units(company.directUnits)} directly, worth ${money(company.direct)}. None of the funds we can see hold ${name}.`;
  }
  return `You don't own ${name} directly, so your brokerage doesn't list it. All ${money(company.total)} is inside your funds.`;
}

// 2. Why is it in each fund? Its weight there, worked out from the dollars:
// $137.04 of Tesla in $8,373.75 of SPY is 1.64% of the fund.
export function insideFunds(company: CompanyExposure, funds: FundSummary[]) {
  return company.byFund.map((entry) => {
    const fund = funds.find((summary) => summary.symbol === entry.symbol);
    return { symbol: entry.symbol, value: entry.value, weight: fund?.value ? entry.value / fund.value : 0 };
  });
}

// 3. What if it moves? Every dollar of the company moves with it, direct or in a fund.
export function whatIf(company: CompanyExposure, holdingsTotal: number, move: number) {
  const change = company.total * move;
  return { change, share: holdingsTotal ? change / holdingsTotal : 0 };
}

// The slider picks the size of the move, 0% to 100%. A fall and a rise of the same
// size move the same dollars, so one sentence covers both directions.
export function movesText(company: CompanyExposure, holdingsTotal: number, move: number, money: Money): string {
  if (move === 0) return "No move, no change.";
  const { change, share } = whatIf(company, holdingsTotal, move);
  return `Up or down, your holdings move about ${money(change)} (${percentText(share)}).`;
}

// 4. Which part do I control? Shares you hold change when you trade them. The
// part inside a fund changes only when you trade the fund, or the fund changes.
export function controlText(company: CompanyExposure, money: Money): string {
  const funds = company.viaFunds.join(", ");
  if (company.direct > 0 && company.throughFunds > 0) {
    return `You control the ${money(company.direct)} in your own shares. The ${money(company.throughFunds)} inside ${funds} changes only when you buy or sell ${company.viaFunds.length > 1 ? "those funds" : funds}.`;
  }
  if (company.direct > 0) return "All of it is in shares you hold yourself.";
  return `It changes only when you buy or sell ${funds}, or when ${company.viaFunds.length > 1 ? "they change" : "it changes"} what ${company.viaFunds.length > 1 ? "they hold" : "it holds"}.`;
}

// 5. What have I done with it lately? Always answered, even with nothing to list:
// "nothing since Sep 16" is an answer, an empty space looks like a bug.
export function activityNote(
  company: CompanyExposure,
  activityCount: number,
  since: string | undefined,
  notLoaded: string[],
  date: (iso: string) => string,
): { note?: string; warning?: string } {
  const name = shortName(company.name);
  const warning = notLoaded.length
    ? `Couldn't load activity for ${notLoaded.join(", ")}, so some trades may be missing.`
    : undefined;
  // How far back the brokerage's history goes, from each account's sync_status.
  const span = since ? `since ${date(since)}` : "in the history SnapTrade has";

  if (activityCount > 0) return { note: since ? `History from ${date(since)}.` : undefined, warning };
  if (company.direct > 0) {
    const where = since ? `, the earliest date SnapTrade has for your accounts` : "";
    return { note: `No trades or dividends for ${name} ${span}${where}.`, warning };
  }
  const funds = company.viaFunds.join(" and ");
  const itself = company.viaFunds.length > 1 ? "buy and sell inside themselves" : "buys and sells inside itself";
  return { note: `You haven't traded ${name} directly ${span}. What ${funds} ${itself} isn't shown.`, warning };
}

// What have I done with it lately? From /activities.
export function activityText(activity: Activity, money: Money): string {
  const price = money(activity.price, activity.currency);
  switch (activity.kind) {
    case "buy":
      return `Bought ${units(activity.units)} at ${price}`;
    case "sell":
      return `Sold ${units(activity.units)} at ${price}`;
    case "dividend":
      return `Dividend of ${money(activity.amount, activity.currency)}`;
    case "reinvested":
      return `Reinvested a dividend in ${units(activity.units)}`;
    case "stockDividend":
      return activity.units > 0 ? `Stock dividend of ${units(activity.units)}` : "Stock dividend";
  }
}
