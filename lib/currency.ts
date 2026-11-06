// Currency conversion at one dated rate. Kept apart from lib/lookthrough.ts so
// browser code can use it without pulling in the fund data.
import { FX } from "../data/fx";

// Returns null when we have no rate, so callers can show the amount instead of guessing.
export function convertCurrency(value: number, from: string, to: string, fx: typeof FX = FX): number | null {
  if (from === to) return value;
  const usdPer: Record<string, number> = { USD: 1, CAD: 1 / fx.cadPerUsd };
  if (!usdPer[from] || !usdPer[to]) return null;
  return (value * usdPer[from]) / usdPer[to];
}
