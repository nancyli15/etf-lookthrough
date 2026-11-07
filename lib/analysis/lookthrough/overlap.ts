// How much two of your funds hold in common, as a share of each.
import type { Fund } from "../../../data/fund-types";
import type { Flattened } from "./flatten";
import type { FundOverlap, FundSummary } from "./lookthrough";

// Above this much unopened (a fund inside a fund with no file), the overlap is a minimum.
const OVERLAP_INCOMPLETE_ABOVE = 0.05;
const SHARED_COMPANIES_LISTED = 5;

export function fundOverlap(
  summaryA: FundSummary,
  summaryB: FundSummary,
  flattenedA: Flattened,
  flattenedB: Flattened,
  fundA: Fund,
  fundB: Fund,
): FundOverlap {
  const incomplete = Math.max(summaryA.unopenedWeight, summaryB.unopenedWeight) > OVERLAP_INCOMPLETE_ABOVE;

  // The overlap is the smaller weight of each company both funds hold, added up.
  const sharedCompanies: { name: string; weight: number }[] = [];
  for (const [key, companyInA] of flattenedA.companies) {
    const companyInB = flattenedB.companies.get(key);
    if (!companyInB) continue;
    sharedCompanies.push({ name: companyInA.name, weight: Math.min(companyInA.weight, companyInB.weight) });
  }
  sharedCompanies.sort((first, second) => second.weight - first.weight);

  // These two share one list on purpose: FXAIX is SPY's list standing in, so it's
  // the same index, not two funds that happen to overlap.
  if (fundA.approximatedBy === summaryB.symbol || fundB.approximatedBy === summaryA.symbol) {
    return {
      fundA: summaryA.symbol,
      fundB: summaryB.symbol,
      sharedWeight: 1,
      sharedCompanies: [],
      basis: "same-list",
      incomplete,
    };
  }
  return {
    fundA: summaryA.symbol,
    fundB: summaryB.symbol,
    sharedWeight: sharedCompanies.reduce((sum, company) => sum + company.weight, 0),
    sharedCompanies: sharedCompanies.slice(0, SHARED_COMPANIES_LISTED).map((company) => company.name),
    basis: "holdings",
    incomplete,
  };
}
