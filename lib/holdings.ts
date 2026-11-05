// Turns /positions/all responses from every account into one clean list of
// holdings, with real numbers, ready for the look-through math.

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

// /positions/all returns { results: [...] }. Read defensively: this is outside data.
export function positionsOf(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  const results = (data as { results?: unknown })?.results;
  return Array.isArray(results) ? results : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function notLookedThroughReason(kind: string): string {
  if (kind === "crypto") return "Crypto has no companies inside";
  return `${kind || "Unknown type"}: no companies to look through`;
}

export function toHoldings(responses: unknown[]): HoldingsResult {
  const merged = new Map<string, Holding>();
  const skipped: string[] = [];

  for (const response of responses) {
    for (const position of positionsOf(response)) {
      const symbol = position?.instrument?.symbol;
      const currency = position?.currency ?? position?.instrument?.currency;
      const units = toNumber(position?.units);
      const price = toNumber(position?.price);

      if (!symbol || !currency || units === null || price === null) {
        skipped.push(symbol ?? "Unknown position");
        continue;
      }

      const figi: string | undefined = position.instrument.figi_instrument?.figi_code ?? undefined;
      // FIGI is the stable ID, but crypto has none, so fall back to the symbol.
      // Currency is part of the key because CAD and USD values can't be added yet.
      const key = `${figi ?? symbol}|${currency}`;
      const value = units * price;

      const existing = merged.get(key);
      if (existing) {
        existing.units += units;
        existing.value += value;
        continue;
      }

      // Lowercased so "ETF" and "etf" aren't treated as different things.
      const kind = String(position.instrument.kind ?? "").toLowerCase();
      merged.set(key, {
        symbol,
        rawSymbol: stringOrUndefined(position.instrument.raw_symbol),
        name: position.instrument.description ?? symbol,
        kind,
        figi,
        exchange: stringOrUndefined(position.instrument.exchange),
        units,
        price,
        currency,
        value,
        notLookedThrough: LOOK_THROUGH_KINDS.has(kind) ? undefined : notLookedThroughReason(kind),
        cashEquivalent: position.cash_equivalent === true,
      });
    }
  }

  return { holdings: [...merged.values()], skipped };
}
