// Opens a fund into one weight per company, including funds held inside funds.
import type { Fund } from "../../../data/fund-types";
import { companyKey } from "./identity";

// Every weight is a fraction of the top fund: 0.07 means 7% of it.
export type Flattened = {
  companies: Map<string, { symbol: string; name: string; weight: number }>; // Keyed by companyKey.
  unopened: Map<string, { name: string; weight: number }>; // Funds inside it we have no file for.
  nonCompanyWeight: number; // Cash, futures and currency lines, from every level.
};

// Opens a fund all the way down, turning it into a weight for each company.
// Recursive because funds hold funds, like XEF holding IEFA. Each level multiplies
// the weights. (XEQT's file is already looked through by BlackRock, so it's flat.)
export function flatten(root: Fund, funds: Record<string, Fund>, withoutData: Set<string>): Flattened {
  const flattened: Flattened = { companies: new Map(), unopened: new Map(), nonCompanyWeight: 0 };

  // fundWeight: how much of the top fund this fund makes up (1 for the top fund).
  // fundsAbove: the funds already opened on the way down, to catch a fund that holds itself.
  function visit(fund: Fund, fundWeight: number, fundsAbove: string[]) {
    flattened.nonCompanyWeight += fundWeight * fund.nonCompanyWeight;
    for (const holding of fund.holdings) {
      const weight = fundWeight * holding.weight;
      const nestedFund = funds[holding.symbol];
      if (nestedFund && !fundsAbove.includes(holding.symbol)) {
        visit(nestedFund, weight, [...fundsAbove, holding.symbol]);
      } else if (nestedFund || withoutData.has(holding.symbol)) {
        // No file, or a loop in the data: keep the money visible rather than lose it.
        const existing = flattened.unopened.get(holding.symbol);
        flattened.unopened.set(holding.symbol, { name: holding.name, weight: (existing?.weight ?? 0) + weight });
      } else {
        // Fund files list US companies without a currency, so "USD" is the default market.
        const key = companyKey(holding.symbol, holding.exchange, "USD");
        const existing = flattened.companies.get(key);
        flattened.companies.set(key, {
          symbol: existing?.symbol ?? holding.symbol,
          name: existing?.name ?? holding.name,
          weight: (existing?.weight ?? 0) + weight,
        });
      }
    }
  }

  visit(root, 1, [root.symbol]);
  return flattened;
}
