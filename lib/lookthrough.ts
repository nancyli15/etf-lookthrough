// The core math. For each company:
//   exposure = value held directly + Σ (value of each fund × company's weight in that fund)
// Pure functions with no network or UI, so the numbers can be tested by hand.
import type { Fund } from "../data/fund-types";
import { COMPANY_BY_SYMBOL, FUNDS, FUNDS_WITHOUT_DATA } from "../data/funds";
import { FX } from "../data/fx";
import type { Holding } from "./holdings";

export type CompanyExposure = {
  key: string;
  symbol: string;
  name: string;
  direct: number;
  throughFunds: number;
  total: number;
  percent: number; // Fraction of the portfolio total.
  viaFunds: string[]; // The funds you hold that contain it, not the funds nested inside them.
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
  basis: "top-holdings" | "same-list";
  incomplete: boolean; // Enough sits in unopened funds that the true overlap could be much higher.
};

export type LookThroughResult = {
  currency: string;
  total: number;
  companies: CompanyExposure[]; // Largest first.
  directHoldings: DirectHolding[]; // Largest first.
  funds: FundSummary[];
  overlaps: FundOverlap[]; // Largest first.
  otherInFunds: number; // Smaller holdings and cash inside funds, beyond each fund's top list.
  insideUnopenedFunds: { symbol: string; name: string; value: number }[];
  notLookedThrough: { symbol: string; name: string; value: number; reason: string }[];
  unconverted: { symbol: string; name: string; value: number; currency: string }[]; // Not in the total.
  fxAsOf?: string; // Set only if a conversion happened.
};

type Options = {
  funds?: Record<string, Fund>;
  fundsWithoutData?: Set<string>;
  fx?: typeof FX;
};

const FUND_KINDS = new Set(["etf", "mutualfund"]);
const OVERLAP_INCOMPLETE_ABOVE = 0.05;

// Fund files and SnapTrade can name the same exchange differently, so reduce both
// to a market. "Nyse Euronext" is Paris, not New York, so it stays separate.
function marketOf(exchange: string | undefined, currency: string): string {
  if (!exchange) return currency === "USD" ? "US" : currency === "CAD" ? "TSX" : currency;
  if (/euronext/i.test(exchange)) return exchange;
  if (/nasdaq|new york stock exchange|nyse|cboe|xnas|xnys|arcx|bats/i.test(exchange)) return "US";
  if (/toronto|^tsx$|xtse/i.test(exchange)) return "TSX";
  return exchange;
}

// A ticker alone isn't an identity: ROP is Roche in Switzerland and Roper in the US.
function companyKey(symbol: string, exchange: string | undefined, currency: string): string {
  const market = marketOf(exchange, currency);
  if (market === "US" && COMPANY_BY_SYMBOL[symbol]) return COMPANY_BY_SYMBOL[symbol];
  return `${symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")}|${market}`; // BRK.B and BRKB match.
}

// Brokerages may send Canadian listings with a suffix, like XEQT.TO. Fund files never do.
function cleanTicker(holding: Holding): string {
  return (holding.rawSymbol ?? holding.symbol).replace(/\.(TO|V|CN|NE)$/i, "");
}

type Flattened = {
  companies: Map<string, { symbol: string; name: string; weight: number }>;
  unopened: Map<string, { name: string; weight: number }>;
  other: number;
};

// Opens a fund all the way down, turning it into a weight for each company.
// Recursive because funds hold funds: XEQT → XTOT → ITOT → Apple.
function flatten(root: Fund, funds: Record<string, Fund>, withoutData: Set<string>): Flattened {
  const flattened: Flattened = { companies: new Map(), unopened: new Map(), other: 0 };

  function visit(fund: Fund, scale: number, path: string[]) {
    flattened.other += scale * fund.other;
    for (const holding of fund.holdings) {
      const weight = scale * holding.weight;
      const nested = funds[holding.symbol];
      if (nested && !path.includes(holding.symbol)) {
        visit(nested, weight, [...path, holding.symbol]);
      } else if (nested || withoutData.has(holding.symbol)) {
        // No file, or a loop in the data: keep the money visible rather than lose it.
        const seen = flattened.unopened.get(holding.symbol);
        flattened.unopened.set(holding.symbol, { name: holding.name, weight: (seen?.weight ?? 0) + weight });
      } else {
        const key = companyKey(holding.symbol, holding.exchange, "USD");
        const seen = flattened.companies.get(key);
        flattened.companies.set(key, {
          symbol: seen?.symbol ?? holding.symbol,
          name: seen?.name ?? holding.name,
          weight: (seen?.weight ?? 0) + weight,
        });
      }
    }
  }

  visit(root, 1, [root.symbol]);
  return flattened;
}

// Returns null when we have no rate, so callers can show the amount instead of guessing.
export function convertCurrency(value: number, from: string, to: string, fx: typeof FX = FX): number | null {
  if (from === to) return value;
  const usdPer: Record<string, number> = { USD: 1, CAD: 1 / fx.cadPerUsd };
  if (!usdPer[from] || !usdPer[to]) return null;
  return (value * usdPer[from]) / usdPer[to];
}

function chooseCurrency(holdings: Holding[]): string {
  const currencies = new Set(holdings.map((holding) => holding.currency));
  if (currencies.size === 1) return holdings[0].currency;
  return currencies.has("CAD") ? "CAD" : "USD";
}

function fundOverlap(
  summaryA: FundSummary,
  summaryB: FundSummary,
  flattenedA: Flattened,
  flattenedB: Flattened,
  fundA: Fund,
  fundB: Fund,
): FundOverlap {
  const incomplete = Math.max(summaryA.unopenedWeight, summaryB.unopenedWeight) > OVERLAP_INCOMPLETE_ABOVE;
  // These two share one list on purpose, so their top-25 overlap would understate it.
  if (fundA.approximatedBy === summaryB.symbol || fundB.approximatedBy === summaryA.symbol) {
    return {
      fundA: summaryA.symbol,
      fundB: summaryB.symbol,
      sharedWeight: 1,
      sharedCompanies: [],
      basis: "same-list",
      incomplete,
    };
  }

  // The overlap is the smaller weight of each company both funds hold.
  const shared: { name: string; weight: number }[] = [];
  for (const [key, companyInA] of flattenedA.companies) {
    const companyInB = flattenedB.companies.get(key);
    if (companyInB) shared.push({ name: companyInA.name, weight: Math.min(companyInA.weight, companyInB.weight) });
  }
  shared.sort((first, second) => second.weight - first.weight);
  return {
    fundA: summaryA.symbol,
    fundB: summaryB.symbol,
    sharedWeight: shared.reduce((sum, company) => sum + company.weight, 0),
    sharedCompanies: shared.slice(0, 5).map((company) => company.name),
    basis: "top-holdings",
    incomplete,
  };
}

export function lookThrough(holdings: Holding[], options: Options = {}): LookThroughResult {
  const funds = options.funds ?? FUNDS;
  const withoutData = options.fundsWithoutData ?? FUNDS_WITHOUT_DATA;
  const fx = options.fx ?? FX;

  const currency = chooseCurrency(holdings);

  const result: LookThroughResult = {
    currency: holdings.length ? currency : "USD",
    total: 0,
    companies: [],
    directHoldings: [],
    funds: [],
    overlaps: [],
    otherInFunds: 0,
    insideUnopenedFunds: [],
    notLookedThrough: [],
    unconverted: [],
  };

  const companies = new Map<string, CompanyExposure>();
  const summaries = new Map<string, FundSummary>();
  const flattened = new Map<string, Flattened>();
  const unopened = new Map<string, { symbol: string; name: string; value: number }>();

  function addToCompany(key: string, symbol: string, name: string, direct: number, through: number, via?: string) {
    const exposure = companies.get(key) ?? {
      key,
      symbol,
      name: COMPANY_BY_SYMBOL[symbol] && !key.includes("|") ? COMPANY_BY_SYMBOL[symbol] : name,
      direct: 0,
      throughFunds: 0,
      total: 0,
      percent: 0,
      viaFunds: [],
    };
    exposure.direct += direct;
    exposure.throughFunds += through;
    exposure.total += direct + through;
    if (via && !exposure.viaFunds.includes(via)) exposure.viaFunds.push(via);
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
    result.total += value;

    if (holding.notLookedThrough) {
      result.notLookedThrough.push({
        symbol: holding.symbol,
        name: holding.name,
        value,
        reason: holding.notLookedThrough,
      });
      continue;
    }

    const ticker = cleanTicker(holding);
    if (!FUND_KINDS.has(holding.kind)) {
      addToCompany(companyKey(ticker, holding.exchange, holding.currency), ticker, holding.name, value, 0);
      result.directHoldings.push({ symbol: ticker, name: holding.name, units: holding.units, value });
      continue;
    }

    const fund = funds[ticker];
    if (!fund) {
      result.notLookedThrough.push({
        symbol: holding.symbol,
        name: holding.name,
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
    .map((company) => ({ ...company, percent: result.total ? company.total / result.total : 0 }))
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
