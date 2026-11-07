// Wording and math for a company's dropdown in the combined table. It answers
// three questions, in order: how much do I own, why do I own it (which funds),
// and why does it matter (what if the price moves). Then your own trades.
//
// Facts only, never advice: it says what changes a number, not what to do.
// No fund data imported, so the browser can use it.
import type { Activity } from "../../portfolio/activities/activities";
import { percentText } from "../format/format";
import type { CompanyExposure, FundSummary } from "../../analysis/lookthrough/lookthrough";
import { shortName } from "../names/names";

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

// 1. How much do I own? A short label, then one sentence. Brokerages list only
// the shares you bought, so the sentence says what the funds add.
export function ownershipLabel(company: CompanyExposure): string {
  if (company.direct > 0 && company.throughFunds > 0) return "Direct + funds";
  if (company.direct > 0) return "Direct only";
  return "Through funds only";
}

export function ownershipText(company: CompanyExposure, money: Money): string {
  const name = shortName(company.name);
  if (company.direct > 0 && company.throughFunds > 0) {
    const extra = company.throughFunds / company.direct;
    return `You bought ${money(company.direct)} (${units(company.directUnits)}) directly. Your funds add ${money(company.throughFunds)}, ${percentText(extra)} more than your brokerage shows.`;
  }
  if (company.direct > 0) {
    return `All of it is the ${units(company.directUnits)} you bought. None of the funds we can see hold ${name}.`;
  }
  const count = company.viaFunds.length;
  const from = count === 1 ? company.viaFunds[0] : `${count} funds`;
  return `You don't own ${name} shares directly, so your brokerage doesn't list it. All of it comes through ${from}.`;
}

// 2. Why do I own it? One row per fund, biggest first. Its weight in the fund is
// worked out from the dollars: $137.04 of Tesla in $8,373.75 of SPY is 1.64%.
// `part` is the fund's share of your whole exposure, which sets the bar's length.
export function insideFunds(company: CompanyExposure, funds: FundSummary[]) {
  return company.byFund
    .map((entry) => {
      const fund = funds.find((summary) => summary.symbol === entry.symbol);
      return {
        symbol: entry.symbol,
        value: entry.value,
        weight: fund?.value ? entry.value / fund.value : 0,
        part: company.total ? entry.value / company.total : 0,
        // FXAIX uses SPY's list, so both show the same weight. Saying so stops that looking like a bug.
        approximatedBy: fund?.approximatedBy,
      };
    })
    .sort((a, b) => b.value - a.value);
}

// 3. What if it moves? Every dollar of the company moves with it, direct or in a fund.
export function whatIf(company: CompanyExposure, holdingsTotal: number, move: number) {
  const change = company.total * move;
  return { change, share: holdingsTotal ? change / holdingsTotal : 0 };
}

// "+CA$181.98" or "−CA$181.98": the sign is the point, so it's always written.
export function signedMoney(value: number, money: Money): string {
  if (value === 0) return money(0);
  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

// The slider runs from −50% to +50%, so a fall reads as a loss, not "up or down".
export function movesText(company: CompanyExposure, holdingsTotal: number, move: number, money: Money): string {
  if (move === 0) return "No move, no change.";
  const { change, share } = whatIf(company, holdingsTotal, move);
  const size = `${Math.round(Math.abs(move) * 100)}%`;
  const [direction, result] = move > 0 ? ["rise", "gain"] : ["fall", "lose"];
  const sign = move > 0 ? "+" : "−";
  return `For a ${size} ${direction} in ${shortName(company.name)}'s price, your holdings would ${result} about ${money(Math.abs(change))} (${sign}${weightText(Math.abs(share))}).`;
}

// Both parts move together: a stock's price is the same whether you hold it yourself
// or through a fund. When there are two parts, name each so "is this combined?" is answered.
export function movesParts(company: CompanyExposure, move: number, money: Money): string | undefined {
  if (move === 0 || company.direct <= 0 || company.throughFunds <= 0) return undefined;
  return `${signedMoney(company.direct * move, money)} on the shares you bought, ${signedMoney(company.throughFunds * move, money)} inside ${company.viaFunds.join(", ")}.`;
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
  // These are only trades you made yourself. A fund's own trades aren't yours, so
  // when the company is also inside your funds, say so instead of leaving it to guess.
  const fundsNote = company.viaFunds.length ? " Trades inside your funds aren't included." : "";

  if (activityCount > 0) {
    const history = since ? `History from ${date(since)}.` : "";
    return { note: `${history}${fundsNote}`.trim() || undefined, warning };
  }
  if (company.direct > 0) return { note: `No ${name} trades or dividends ${span}.${fundsNote}`, warning };
  return { note: `No direct ${name} trades ${span}.${fundsNote}`, warning };
}

// What have I done with it lately? From /activities.
export function activityText(activity: Activity, money: Money): string {
  const price = money(activity.price, activity.currency);
  // The cash amount is what you'd recognize as "what I paid", so it comes first. It's
  // SnapTrade's `amount`, which can differ from shares × price (fees, exchange rates).
  const cash = money(activity.amount || activity.units * activity.price, activity.currency);
  switch (activity.kind) {
    case "buy":
      return `Bought ${units(activity.units)} for ${cash} (${price} each)`;
    case "sell":
      return `Sold ${units(activity.units)} for ${cash} (${price} each)`;
    case "dividend":
      return `Dividend of ${money(activity.amount, activity.currency)}`;
    case "reinvested":
      return `Reinvested a dividend in ${units(activity.units)}`;
    case "stockDividend":
      return activity.units > 0 ? `Stock dividend of ${units(activity.units)}` : "Stock dividend";
  }
}
