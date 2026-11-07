// The core math. For each company:
//   exposure = value held directly + Σ (value of each fund × company's weight in that fund)
// Pure functions with no network or UI, so the numbers can be tested by hand.
//
// The steps live in their own files: identity.ts (is this the same company?),
// flatten.ts (open a fund all the way down) and overlap.ts (how much two funds share).
import type { Fund } from "../../../data/fund-types";
import { COMPANY_BY_SYMBOL, FUNDS, FUNDS_WITHOUT_DATA } from "../../../data/funds";
import { FX } from "../../../data/fx";
import { convertCurrency } from "../../portfolio/currency/currency";
import type { Holding } from "../../portfolio/holdings/holdings";
import { companyKey, cleanTicker } from "./identity";
import { flatten, type Flattened } from "./flatten";
import { fundOverlap } from "./overlap";

export type CompanyExposure = {
  key: string;
  symbol: string;
  name: string;
  direct: number;
  directUnits: number; // Shares held directly, across accounts.
  throughFunds: number;
  total: number;
  percent: number; // Fraction of the portfolio total.
  viaFunds: string[]; // The funds you hold that contain it, not the funds nested inside them.
  byFund: { symbol: string; value: number }[]; // How much comes through each of those funds, largest first.
};

// A stock you bought yourself. Value is in the report's currency.
export type DirectHolding = {
  symbol: string;
  name: string;
  units: number;
  value: number;
};

export type FundSummary = {
  symbol: string;
  name: string;
  value: number;
  asOf: string;
  approximatedBy?: string;
  otherWeight: number;
  unopenedWeight: number;
};

export type FundOverlap = {
  fundA: string;
  fundB: string;
  sharedWeight: number; // Fraction of each fund in common.
  sharedCompanies: string[]; // Largest few.
  basis: "holdings" | "same-list";
  incomplete: boolean; // Enough sits in unopened funds that the true overlap could be much higher.
};

export type LookThroughResult = {
  currency: string;
  total: number;
  companies: CompanyExposure[]; // Largest first.
  directHoldings: DirectHolding[]; // Largest first.
  funds: FundSummary[];
  overlaps: FundOverlap[]; // Largest first.
  otherInFunds: number; // Cash, futures and other non-stock lines inside funds.
  insideUnopenedFunds: { symbol: string; name: string; value: number }[];
  notLookedThrough: { symbol: string; name: string; kind: string; value: number; reason: string }[];
  cashEquivalents: { symbol: string; name: string; value: number }[]; // Already inside the cash balance.
  unconverted: { symbol: string; name: string; value: number; currency: string }[]; // Not in the total.
  fxAsOf?: string; // Set only if a conversion happened.
};

type Options = {
  funds?: Record<string, Fund>;
  fundsWithoutData?: Set<string>;
  fx?: typeof FX;
  currency?: string; // Report in this currency. Without it, the holdings decide.
};

const FUND_KINDS = new Set(["etf", "mutualfund"]);

function chooseCurrency(holdings: Holding[]): string {
  const currencies = new Set(holdings.map((holding) => holding.currency));
  if (currencies.size === 1) return holdings[0].currency;
  return currencies.has("CAD") ? "CAD" : "USD";
}

export function lookThrough(holdings: Holding[], options: Options = {}): LookThroughResult {
  const funds = options.funds ?? FUNDS;
  const withoutData = options.fundsWithoutData ?? FUNDS_WITHOUT_DATA;
  const fx = options.fx ?? FX;

  const currency = options.currency ?? chooseCurrency(holdings);

  const result: LookThroughResult = {
    currency: options.currency ?? (holdings.length ? currency : "USD"),
    total: 0,
    companies: [],
    directHoldings: [],
    funds: [],
    overlaps: [],
    otherInFunds: 0,
    insideUnopenedFunds: [],
    notLookedThrough: [],
    cashEquivalents: [],
    unconverted: [],
  };

  const companies = new Map<string, CompanyExposure>();
  const summaries = new Map<string, FundSummary>();
  const flattened = new Map<string, Flattened>();
  const unopened = new Map<string, { symbol: string; name: string; value: number }>();

  function addToCompany(
    key: string,
    symbol: string,
    name: string,
    direct: number,
    through: number,
    via?: string,
    directUnits = 0,
  ) {
    const exposure = companies.get(key) ?? {
      key,
      symbol,
      name: COMPANY_BY_SYMBOL[symbol] && !key.includes("|") ? COMPANY_BY_SYMBOL[symbol] : name,
      direct: 0,
      directUnits: 0,
      throughFunds: 0,
      total: 0,
      percent: 0,
      viaFunds: [],
      byFund: [],
    };
    exposure.direct += direct;
    exposure.directUnits += directUnits;
    exposure.throughFunds += through;
    exposure.total += direct + through;
    if (via) {
      if (!exposure.viaFunds.includes(via)) exposure.viaFunds.push(via);
      const fromFund = exposure.byFund.find((entry) => entry.symbol === via);
      if (fromFund) fromFund.value += through;
      else exposure.byFund.push({ symbol: via, value: through });
    }
    companies.set(key, exposure);
  }

  for (const holding of holdings) {
    const value = convertCurrency(holding.value, holding.currency, currency, fx);
    if (value === null) {
      result.unconverted.push({
        symbol: holding.symbol,
        name: holding.name,
        value: holding.value,
        currency: holding.currency,
      });
      continue;
    }
    if (holding.currency !== currency) result.fxAsOf = fx.asOf;

    // SnapTrade reports money market funds as a position and inside the cash balance.
    // Counting the position as well would add the same money twice.
    if (holding.cashEquivalent) {
      result.cashEquivalents.push({ symbol: holding.symbol, name: holding.name, value });
      continue;
    }

    result.total += value;

    if (holding.notLookedThrough) {
      result.notLookedThrough.push({
        symbol: holding.symbol,
        name: holding.name,
        kind: holding.kind,
        value,
        reason: holding.notLookedThrough,
      });
      continue;
    }

    const ticker = cleanTicker(holding);
    if (!FUND_KINDS.has(holding.kind)) {
      addToCompany(companyKey(ticker, holding.exchange, holding.currency), ticker, holding.name, value, 0, undefined, holding.units);
      result.directHoldings.push({ symbol: ticker, name: holding.name, units: holding.units, value });
      continue;
    }

    const fund = funds[ticker];
    if (!fund) {
      result.notLookedThrough.push({
        symbol: holding.symbol,
        name: holding.name,
        kind: holding.kind,
        value,
        reason: "We don't have this fund's contents yet",
      });
      continue;
    }

    const flattenedFund = flattened.get(fund.symbol) ?? flatten(fund, funds, withoutData);
    flattened.set(fund.symbol, flattenedFund);

    const unopenedWeight = [...flattenedFund.unopened.values()].reduce((sum, nested) => sum + nested.weight, 0);
    const summary = summaries.get(fund.symbol) ?? {
      symbol: fund.symbol,
      name: fund.name,
      value: 0,
      asOf: fund.asOf,
      approximatedBy: fund.approximatedBy,
      otherWeight: flattenedFund.other,
      unopenedWeight,
    };
    summary.value += value;
    summaries.set(fund.symbol, summary);

    result.otherInFunds += value * flattenedFund.other;
    for (const [key, company] of flattenedFund.companies) {
      addToCompany(key, company.symbol, company.name, 0, value * company.weight, fund.symbol);
    }
    for (const [symbol, nested] of flattenedFund.unopened) {
      const seen = unopened.get(symbol) ?? { symbol, name: nested.name, value: 0 };
      seen.value += value * nested.weight;
      unopened.set(symbol, seen);
    }
  }

  result.companies = [...companies.values()]
    .map((company) => ({
      ...company,
      percent: result.total ? company.total / result.total : 0,
      byFund: [...company.byFund].sort((first, second) => second.value - first.value),
    }))
    .sort((first, second) => second.total - first.total);
  result.directHoldings.sort((first, second) => second.value - first.value);
  result.funds = [...summaries.values()].sort((first, second) => second.value - first.value);
  result.insideUnopenedFunds = [...unopened.values()].sort((first, second) => second.value - first.value);

  // Compare each pair of funds once.
  for (let indexA = 0; indexA < result.funds.length; indexA++) {
    for (let indexB = indexA + 1; indexB < result.funds.length; indexB++) {
      const summaryA = result.funds[indexA];
      const summaryB = result.funds[indexB];
      result.overlaps.push(
        fundOverlap(
          summaryA,
          summaryB,
          flattened.get(summaryA.symbol)!,
          flattened.get(summaryB.symbol)!,
          funds[summaryA.symbol],
          funds[summaryB.symbol],
        ),
      );
    }
  }
  result.overlaps.sort((first, second) => second.sharedWeight - first.sharedWeight);

  return result;
}
