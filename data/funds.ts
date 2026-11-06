// Fund contents the app knows about. An ETF that isn't here stays "not supported yet".
import type { Fund } from "./fund-types";
import { FUND_DATA } from "./fund-data";

// FXAIX and SPY track the same index. We don't have Fidelity's file, so SPY's
// list stands in, and the UI can say so.
export const FUNDS: Record<string, Fund> = {
  ...FUND_DATA,
  FXAIX: {
    ...FUND_DATA.SPY,
    symbol: "FXAIX",
    name: "Fidelity 500 Index Fund",
    approximatedBy: "SPY",
  },
};

// Funds that appear inside other funds but have no file yet. Listing them keeps
// them from being counted as companies. A fund with data in FUNDS takes priority.
// IEFA sits inside XEF, and IEMG inside XEC.
export const FUNDS_WITHOUT_DATA = new Set(["IEFA", "IEMG"]);

// Two share classes of one company, so the look-through should show one row.
export const COMPANY_BY_SYMBOL: Record<string, string> = {
  GOOGL: "Alphabet",
  GOOG: "Alphabet",
};
