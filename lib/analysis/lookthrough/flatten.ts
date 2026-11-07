// Opens a fund into one weight per company, including funds held inside funds.
import type { Fund } from "../../../data/fund-types";
import { companyKey } from "./identity";

export type Flattened = {
  companies: Map<string, { symbol: string; name: string; weight: number }>;
  unopened: Map<string, { name: string; weight: number }>;
  other: number;
};

// Opens a fund all the way down, turning it into a weight for each company.
// Recursive because funds hold funds, like XEF holding IEFA. Each level multiplies
// the weights. (XEQT's file is already looked through by BlackRock, so it's flat.)
export function flatten(root: Fund, funds: Record<string, Fund>, withoutData: Set<string>): Flattened {
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
