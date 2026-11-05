export type FundHolding = {
  symbol: string; // A stock, or another fund when funds hold funds.
  name: string;
  exchange?: string; // The same ticker can be different companies: ROP is Roche in Switzerland, Roper in the US.
  weight: number; // Share of the fund, as a fraction: 0.07 means 7%.
};

export type Fund = {
  symbol: string;
  name: string;
  asOf: string; // Date of the holdings file, YYYY-MM-DD. Shown in the UI.
  source: string;
  holdings: FundHolding[]; // Largest first, top 25 at most.
  other: number; // Everything else: smaller holdings and cash, so weights add up to 1.
  approximatedBy?: string; // Set when another fund's list stands in for this one.
};
