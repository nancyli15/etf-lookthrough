// Currency conversion at one dated rate. Kept apart from the look-through math so
// browser code can use it without pulling in the fund data.
import { FX } from "../../../data/fx";

// Returns null when we have no rate, so callers can show the amount instead of guessing.
export function convertCurrency(value: number, from: string, to: string, fx: typeof FX = FX): number | null {
  if (from === to) return value;
  // How many US dollars one unit of each currency is worth.
  const usdPerUnit: Record<string, number> = { USD: 1, CAD: 1 / fx.cadPerUsd };
  if (!usdPerUnit[from] || !usdPerUnit[to]) return null;
  return (value * usdPerUnit[from]) / usdPerUnit[to];
}

// SnapTrade sends a currency either as { code: "CAD" } or as a bare "CAD", depending
// on the endpoint. Returns the code, or undefined if it's neither.
export function currencyCodeOf(currency: unknown): string | undefined {
  const code = (currency as { code?: unknown })?.code ?? currency;
  return typeof code === "string" ? code : undefined;
}
