// Turns /positions/all responses from every account into one clean list of
// holdings, with real numbers, ready for the look-through math.
import { rowsIn, type SnapTradePosition } from "../../snaptrade/responses/responses";
import { currencyCodeOf } from "../currency/currency";

export type Holding = {
  symbol: string;
  rawSymbol?: string;
  name: string;
  kind: string;
  figi?: string;
  exchange?: string;
  units: number;
  price: number; // From the first account seen; brokers' quotes can differ slightly.
  currency: string;
  value: number; // units × price per account, added up across accounts.
  notLookedThrough?: string; // Why this holding stays out of the look-through, if it does.
  cashEquivalent?: boolean; // A money market fund that /balances already counts as cash.
};

export type HoldingsResult = {
  holdings: Holding[];
  skipped: string[]; // Positions we couldn't value, so the UI can say the total is incomplete.
};

// Stocks count as direct exposure and funds get opened up. Anything else, like
// crypto or options, has no companies inside it to find.
const LOOK_THROUGH_KINDS = new Set(["stock", "etf", "mutualfund"]);

// /positions/all returns units and price as strings ("5", "180.5"), so convert first.
// Number("") is 0 in JavaScript, so blanks are caught here: a missing price is not $0.
export function toNumber(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const numericValue = typeof value === "string" ? Number(value) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue) ? numericValue : null;
}

// Text from outside data: a non-empty string, trimmed, or undefined for anything else.
export function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// /positions/all returns { results: [...] }. Accept a bare list too.
export function positionsOf(data: unknown): SnapTradePosition[] {
  return rowsIn<SnapTradePosition>(data, "results");
}


function notLookedThroughReason(kind: string): string {
  if (kind === "crypto") return "Crypto has no companies inside";
  return `${kind || "Unknown type"}: no companies to look through`;
}

export function toHoldings(responses: unknown[]): HoldingsResult {
  // One entry per security and currency, so the same ETF in two accounts becomes one holding.
  const holdingsByKey = new Map<string, Holding>();
  const skipped: string[] = [];

  for (const response of responses) {
    for (const position of positionsOf(response)) {
      const instrument = position?.instrument;
      const symbol = toText(instrument?.symbol);
      // The position's own currency, or else the security's.
      const currency = currencyCodeOf(position?.currency) ?? currencyCodeOf(instrument?.currency);
      const units = toNumber(position?.units);
      const price = toNumber(position?.price);

      if (!symbol || !currency || units === null || price === null) {
        skipped.push(symbol ?? "Unknown position");
        continue;
      }

      const figi = toText(instrument?.figi_instrument?.figi_code);
      // FIGI is the stable ID, but crypto has none, so fall back to the symbol.
      // Currency is part of the key because CAD and USD values can't be added yet.
      const key = `${figi ?? symbol}|${currency}`;
      const value = units * price;

      const existing = holdingsByKey.get(key);
      if (existing) {
        existing.units += units;
        existing.value += value;
        continue;
      }

      // Lowercased so "ETF" and "etf" aren't treated as different things.
      const kind = (toText(instrument?.kind) ?? "").toLowerCase();
      holdingsByKey.set(key, {
        symbol,
        rawSymbol: toText(instrument?.raw_symbol),
        name: toText(instrument?.description) ?? symbol,
        kind,
        figi,
        exchange: toText(instrument?.exchange),
        units,
        price,
        currency,
        value,
        notLookedThrough: LOOK_THROUGH_KINDS.has(kind) ? undefined : notLookedThroughReason(kind),
        cashEquivalent: position.cash_equivalent === true,
      });
    }
  }

  return { holdings: [...holdingsByKey.values()], skipped };
}
