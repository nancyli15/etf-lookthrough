// Where your holdings go, once funds are opened up. Short labels for the donut's
// legend; the card says what each means: the companies you bought, the
// companies inside your funds, the cash and other non-company lines inside your
// funds, and holdings with no companies at all, like crypto. The parts add up to
// exactly the "holdings" in the summary, which a test checks.
// No UI and no fund data here, so the browser can use it.
import type { LookThroughResult } from "./lookthrough";

export type Slice = {
  key: "direct" | "funds" | "fundOther" | "notLooked" | "cash";
  label: string;
  value: number;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function holdingsBreakdown(result: LookThroughResult): Slice[] {
  const slices: Slice[] = [
    { key: "direct", label: "You bought", value: sum(result.companies.map((company) => company.direct)) },
    { key: "funds", label: "In your funds", value: sum(result.companies.map((company) => company.throughFunds)) },
    {
      key: "fundOther",
      // Cash, futures and currency lines inside funds, plus funds we can't open yet.
      label: "Cash inside your funds",
      value: result.otherInFunds + sum(result.insideUnopenedFunds.map((fund) => fund.value)),
    },
    { key: "notLooked", label: "Crypto and other", value: sum(result.notLookedThrough.map((holding) => holding.value)) },
  ];
  return slices.filter((slice) => slice.value > 0);
}

// Net worth, the same way: the holdings parts plus the cash in your accounts. The
// summary card shows this one, so the parts add up to the net worth figure above it.
// "Cash in your accounts" and "Cash inside your funds" are different money, so they
// have different names.
export function netWorthBreakdown(result: LookThroughResult, cash: number): Slice[] {
  const slices = holdingsBreakdown(result);
  if (cash > 0) slices.push({ key: "cash", label: "Cash in your accounts", value: cash });
  return slices;
}
