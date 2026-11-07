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

// For sort(): biggest value first.
const largestValueFirst = (first: { value: number }, second: { value: number }) => second.value - first.value;

// Used only when no currency is passed in. buildReport always passes one; tests don't.
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
    currency,
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

  // Keyed by companyKey, so the same company from different sources adds up in one place.
  const companies = new Map<string, CompanyExposure>();
  const fundSummaries = new Map<string, FundSummary>();
  // Each fund is opened once, even if several accounts hold it.
  const flattenedFunds = new Map<string, Flattened>();
  const unopenedFunds = new Map<string, { symbol: string; name: string; value: number }>();

  // The company's running total, created at $0 the first time it's seen.
  function exposureFor(key: string, symbol: string, name: string): CompanyExposure {
    let exposure = companies.get(key);
    if (!exposure) {
      exposure = {
        key,
        symbol,
        // Share classes like GOOGL and GOOG get one key, their company's name ("Alphabet").
        name: COMPANY_BY_SYMBOL[symbol] === key ? key : name,
        direct: 0,
        directUnits: 0,
        throughFunds: 0,
        total: 0,
        percent: 0,
        viaFunds: [],
        byFund: [],
      };
      companies.set(key, exposure);
    }
    return exposure;
  }

  // Shares of the company you bought yourself.
  function addDirect(key: string, symbol: string, name: string, value: number, units: number) {
    const exposure = exposureFor(key, symbol, name);
    exposure.direct += value;
    exposure.directUnits += units;
    exposure.total += value;
  }

  // The company's part of a fund you hold: fund value × the company's weight in it.
  function addThroughFund(key: string, symbol: string, name: string, value: number, fundSymbol: string) {
    const exposure = exposureFor(key, symbol, name);
    exposure.throughFunds += value;
    exposure.total += value;
    if (!exposure.viaFunds.includes(fundSymbol)) exposure.viaFunds.push(fundSymbol);
    const fromThisFund = exposure.byFund.find((entry) => entry.symbol === fundSymbol);
    if (fromThisFund) fromThisFund.value += value;
    else exposure.byFund.push({ symbol: fundSymbol, value });
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
      addDirect(companyKey(ticker, holding.exchange, holding.currency), ticker, holding.name, value, holding.units);
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

    const flattenedFund = flattenedFunds.get(fund.symbol) ?? flatten(fund, funds, withoutData);
    flattenedFunds.set(fund.symbol, flattenedFund);

    const unopenedWeight = [...flattenedFund.unopened.values()].reduce((sum, nested) => sum + nested.weight, 0);
    const summary = fundSummaries.get(fund.symbol) ?? {
      symbol: fund.symbol,
      name: fund.name,
      value: 0,
      asOf: fund.asOf,
      approximatedBy: fund.approximatedBy,
      otherWeight: flattenedFund.other,
      unopenedWeight,
    };
    summary.value += value;
    fundSummaries.set(fund.symbol, summary);

    result.otherInFunds += value * flattenedFund.other;
    for (const [key, company] of flattenedFund.companies) {
      addThroughFund(key, company.symbol, company.name, value * company.weight, fund.symbol);
    }
    for (const [symbol, nested] of flattenedFund.unopened) {
      const unopenedFund = unopenedFunds.get(symbol) ?? { symbol, name: nested.name, value: 0 };
      unopenedFund.value += value * nested.weight;
      unopenedFunds.set(symbol, unopenedFund);
    }
  }

  result.companies = [...companies.values()]
    .map((company) => ({
      ...company,
      percent: result.total ? company.total / result.total : 0,
      byFund: [...company.byFund].sort(largestValueFirst),
    }))
    .sort((first, second) => second.total - first.total);
  result.directHoldings.sort(largestValueFirst);
  result.funds = [...fundSummaries.values()].sort(largestValueFirst);
  result.insideUnopenedFunds = [...unopenedFunds.values()].sort(largestValueFirst);

  // Compare each pair of funds once.
  for (let indexA = 0; indexA < result.funds.length; indexA++) {
    for (let indexB = indexA + 1; indexB < result.funds.length; indexB++) {
      const summaryA = result.funds[indexA];
      const summaryB = result.funds[indexB];
      result.overlaps.push(
        fundOverlap(
          summaryA,
          summaryB,
          // Every fund in result.funds was flattened above, so these exist.
          flattenedFunds.get(summaryA.symbol)!,
          flattenedFunds.get(summaryB.symbol)!,
          funds[summaryA.symbol],
          funds[summaryB.symbol],
        ),
      );
    }
  }
  result.overlaps.sort((first, second) => second.sharedWeight - first.sharedWeight);

  return result;
}
