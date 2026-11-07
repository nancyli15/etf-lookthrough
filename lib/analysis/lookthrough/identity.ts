// Is this the same company? SnapTrade and the fund files spell tickers and
// exchanges differently, so both are reduced to one key before they're matched.
import { COMPANY_BY_SYMBOL } from "../../../data/funds";
import type { Holding } from "../../portfolio/holdings/holdings";

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
export function companyKey(symbol: string, exchange: string | undefined, currency: string): string {
  const market = marketOf(exchange, currency);
  if (market === "US" && COMPANY_BY_SYMBOL[symbol]) return COMPANY_BY_SYMBOL[symbol];
  return `${symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")}|${market}`; // BRK.B and BRKB match.
}

// Brokerages may send Canadian listings with a suffix, like XEQT.TO. Fund files never do.
export function cleanTicker(holding: Holding): string {
  return (holding.rawSymbol ?? holding.symbol).replace(/\.(TO|V|CN|NE)$/i, "");
}
