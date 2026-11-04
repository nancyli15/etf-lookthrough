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
  a: string;
  b: string;
  sharedWeight: number; // Fraction of each fund in common.
  sharedCompanies: string[]; // Largest few.
  basis: "top-holdings" | "same-list";
  incomplete: boolean; // Enough sits in unopened funds that the true overlap could be much higher.
};

export type LookThroughResult = {
  currency: string;
  total: number;
  companies: CompanyExposure[]; // Largest first.
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
function cleanTicker(h: Holding): string {
  return (h.rawSymbol ?? h.symbol).replace(/\.(TO|V|CN|NE)$/i, "");
}

type Flattened = {
  companies: Map<string, { symbol: string; name: string; weight: number }>;
  unopened: Map<string, { name: string; weight: number }>;
  other: number;
};

// Opens a fund all the way down, turning it into a weight for each company.
// Recursive because funds hold funds: XEQT → XTOT → ITOT → Apple.
function flatten(root: Fund, funds: Record<string, Fund>, withoutData: Set<string>): Flattened {
  const out: Flattened = { companies: new Map(), unopened: new Map(), other: 0 };

  function visit(fund: Fund, scale: number, path: string[]) {
    out.other += scale * fund.other;
    for (const h of fund.holdings) {
      const weight = scale * h.weight;
      const nested = funds[h.symbol];
      if (nested && !path.includes(h.symbol)) {
        visit(nested, weight, [...path, h.symbol]);
      } else if (nested || withoutData.has(h.symbol)) {
        // No file, or a loop in the data: keep the money visible rather than lose it.
        const seen = out.unopened.get(h.symbol);
        out.unopened.set(h.symbol, { name: h.name, weight: (seen?.weight ?? 0) + weight });
      } else {
        const key = companyKey(h.symbol, h.exchange, "USD");
        const seen = out.companies.get(key);
        out.companies.set(key, {
          symbol: seen?.symbol ?? h.symbol,
          name: seen?.name ?? h.name,
          weight: (seen?.weight ?? 0) + weight,
        });
      }
    }
  }

  visit(root, 1, [root.symbol]);
  return out;
}

function chooseCurrency(holdings: Holding[]): string {
  const currencies = new Set(holdings.map((h) => h.currency));
  if (currencies.size === 1) return holdings[0].currency;
  return currencies.has("CAD") ? "CAD" : "USD";
}

function fundOverlap(
  a: FundSummary,
  b: FundSummary,
  flatA: Flattened,
  flatB: Flattened,
  aFund: Fund,
  bFund: Fund,
): FundOverlap {
  const incomplete = Math.max(a.unopenedWeight, b.unopenedWeight) > OVERLAP_INCOMPLETE_ABOVE;
  // These two share one list on purpose, so their top-25 overlap would understate it.
  if (aFund.approximatedBy === b.symbol || bFund.approximatedBy === a.symbol) {
    return { a: a.symbol, b: b.symbol, sharedWeight: 1, sharedCompanies: [], basis: "same-list", incomplete };
  }

  // The overlap is the smaller weight of each company both funds hold.
  const shared: { name: string; weight: number }[] = [];
  for (const [key, company] of flatA.companies) {
    const other = flatB.companies.get(key);
    if (other) shared.push({ name: company.name, weight: Math.min(company.weight, other.weight) });
  }
  shared.sort((x, y) => y.weight - x.weight);
  return {
    a: a.symbol,
    b: b.symbol,
    sharedWeight: shared.reduce((sum, s) => sum + s.weight, 0),
    sharedCompanies: shared.slice(0, 5).map((s) => s.name),
    basis: "top-holdings",
    incomplete,
  };
}

export function lookThrough(holdings: Holding[], options: Options = {}): LookThroughResult {
  const funds = options.funds ?? FUNDS;
  const withoutData = options.fundsWithoutData ?? FUNDS_WITHOUT_DATA;
  const fx = options.fx ?? FX;

  const currency = chooseCurrency(holdings);
  const usdPer: Record<string, number> = { USD: 1, CAD: 1 / fx.cadPerUsd };

  const result: LookThroughResult = {
    currency: holdings.length ? currency : "USD",
    total: 0,
    companies: [],
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
    const c = companies.get(key) ?? {
      key,
      symbol,
      name: COMPANY_BY_SYMBOL[symbol] && !key.includes("|") ? COMPANY_BY_SYMBOL[symbol] : name,
      direct: 0,
      throughFunds: 0,
      total: 0,
      percent: 0,
      viaFunds: [],
    };
    c.direct += direct;
    c.throughFunds += through;
    c.total += direct + through;
    if (via && !c.viaFunds.includes(via)) c.viaFunds.push(via);
    companies.set(key, c);
  }

  for (const h of holdings) {
    let value = h.value;
    if (h.currency !== currency) {
      if (!usdPer[h.currency] || !usdPer[currency]) {
        result.unconverted.push({ symbol: h.symbol, name: h.name, value: h.value, currency: h.currency });
        continue;
      }
      value = (h.value * usdPer[h.currency]) / usdPer[currency];
      result.fxAsOf = fx.asOf;
    }
    result.total += value;

    if (h.notLookedThrough) {
      result.notLookedThrough.push({ symbol: h.symbol, name: h.name, value, reason: h.notLookedThrough });
      continue;
    }

    const ticker = cleanTicker(h);
    if (!FUND_KINDS.has(h.kind)) {
      addToCompany(companyKey(ticker, h.exchange, h.currency), ticker, h.name, value, 0);
      continue;
    }

    const fund = funds[ticker];
    if (!fund) {
      result.notLookedThrough.push({
        symbol: h.symbol,
        name: h.name,
        value,
        reason: "We don't have this fund's contents yet",
      });
      continue;
    }

    const flat = flattened.get(fund.symbol) ?? flatten(fund, funds, withoutData);
    flattened.set(fund.symbol, flat);

    const unopenedWeight = [...flat.unopened.values()].reduce((sum, u) => sum + u.weight, 0);
    const summary = summaries.get(fund.symbol) ?? {
      symbol: fund.symbol,
      name: fund.name,
      value: 0,
      asOf: fund.asOf,
      approximatedBy: fund.approximatedBy,
      otherWeight: flat.other,
      unopenedWeight,
    };
    summary.value += value;
    summaries.set(fund.symbol, summary);

    result.otherInFunds += value * flat.other;
    for (const [key, c] of flat.companies) addToCompany(key, c.symbol, c.name, 0, value * c.weight, fund.symbol);
    for (const [symbol, u] of flat.unopened) {
      const seen = unopened.get(symbol) ?? { symbol, name: u.name, value: 0 };
      seen.value += value * u.weight;
      unopened.set(symbol, seen);
    }
  }

  result.companies = [...companies.values()]
    .map((c) => ({ ...c, percent: result.total ? c.total / result.total : 0 }))
    .sort((x, y) => y.total - x.total);
  result.funds = [...summaries.values()].sort((x, y) => y.value - x.value);
  result.insideUnopenedFunds = [...unopened.values()].sort((x, y) => y.value - x.value);

  for (let i = 0; i < result.funds.length; i++) {
    for (let j = i + 1; j < result.funds.length; j++) {
      const a = result.funds[i];
      const b = result.funds[j];
      result.overlaps.push(
        fundOverlap(a, b, flattened.get(a.symbol)!, flattened.get(b.symbol)!, funds[a.symbol], funds[b.symbol]),
      );
    }
  }
  result.overlaps.sort((x, y) => y.sharedWeight - x.sharedWeight);

  return result;
}
