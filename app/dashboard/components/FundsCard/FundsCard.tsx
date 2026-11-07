// Everything about your funds in one card: how big each one is, and where they
// overlap. How much of a fund we can match to companies is nearly always 99%+, so
// it's in an ⓘ note per fund instead of a column. The table is the donut's legend:
// each row has its slice's colour, so the amounts aren't listed twice.
import { formatMoney, percentText, sumOf } from "@/lib/display/format/format";
import type { LookThroughResult } from "@/lib/analysis/lookthrough/lookthrough";
import Donut, { type DonutSlice } from "../Donut/Donut";
import InfoPopover from "../InfoPopover/InfoPopover";
import OverlapList from "../OverlapList/OverlapList";
import "./FundsCard.css";

// Not blue, orange or aqua: those mean "you bought", "via funds" and "cash in your
// accounts" elsewhere on the page. Four checked colours, then grey for "Other". Red was
// left out: next to green or pink, colourblind readers couldn't tell them apart.
const FUND_COLORS = ["#eda100", "#6250d6", "#e87ba4", "#008300"];
const OTHER_FUNDS_COLOR = "var(--series-neutral)";
const MAX_SLICES = FUND_COLORS.length;

type Props = {
  result: LookThroughResult;
  money: (value: number) => string;
  onFundClick: (symbol: string) => void; // Shows that fund's companies in the table below.
};

export default function FundsCard({ result, money, onFundClick }: Props) {
  if (result.funds.length === 0) return null;
  const shareOfHoldings = (value: number) => percentText(result.total ? value / result.total : 0);
  const unopened = sumOf(result.insideUnopenedFunds, (fund) => fund.value);
  const fundsTotal = sumOf(result.funds, (fund) => fund.value);

  // Funds come largest first. Past four, the rest fold into "Other", so no colour is invented.
  const slicedFunds = result.funds.slice(0, MAX_SLICES);
  const otherFundsValue = sumOf(result.funds.slice(MAX_SLICES), (fund) => fund.value);
  const slices: DonutSlice[] = [
    ...slicedFunds.map((fund, index) => ({ key: fund.symbol, label: fund.symbol, value: fund.value, color: FUND_COLORS[index] })),
    ...(otherFundsValue > 0 ? [{ key: "other", label: "Other funds", value: otherFundsValue, color: OTHER_FUNDS_COLOR }] : []),
  ];

  return (
    <div className="card">
      <h2>Your funds</h2>
      <div className="funds-layout">
        <table>
          <thead>
            <tr>
              <th>Fund</th>
              <th className="num">Value</th>
              <th className="num">Of your funds</th>
            </tr>
          </thead>
          <tbody>
            {result.funds.map((fund, index) => {
              const color = index < MAX_SLICES ? FUND_COLORS[index] : OTHER_FUNDS_COLOR;
              // The share of the fund we could match to named companies.
              const matchedWeight = 1 - fund.nonCompanyWeight - fund.unopenedWeight;
              return (
                <tr key={fund.symbol}>
                  <td>
                    {result.funds.length > 1 && (
                      <i className="swatch" style={{ background: color }} aria-hidden="true" />
                    )}
                    <button
                      className="link"
                      type="button"
                      onClick={() => onFundClick(fund.symbol)}
                      title={`Show the companies inside ${fund.symbol}`}
                    >
                      {fund.symbol}
                    </button>{" "}
                    <span className="muted">{fund.name}</span>{" "}
                    <InfoPopover label={`About ${fund.symbol}'s contents`}>
                      <span className="info-line">
                        <strong>{percentText(matchedWeight)}</strong> of {fund.symbol} is matched to named companies, all in
                        the table below.
                      </span>
                      <span className="info-line muted">
                        The other {money(fund.value * (1 - matchedWeight))} is cash, futures or currency contracts inside the
                        fund
                        {fund.unopenedWeight > 0 && ", or funds we can't open yet"}.
                      </span>
                      {fund.approximatedBy && (
                        <span className="info-line muted">Uses {fund.approximatedBy}'s holdings, because both track the same index.</span>
                      )}
                      <span className="info-line muted">Holdings as of {fund.asOf}.</span>
                    </InfoPopover>
                  </td>
                  <td className="num">{money(fund.value)}</td>
                  <td className="num">{percentText(fundsTotal ? fund.value / fundsTotal : 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {unopened > 0 && (
              <tr className="subtotal">
                <td>
                  Inside funds we can't open yet ({result.insideUnopenedFunds.map((fund) => fund.symbol).join(", ")})
                </td>
                <td className="num">{money(unopened)}</td>
                <td />
              </tr>
            )}
            <tr>
              <td>
                Total in your funds
                <div className="muted small">{shareOfHoldings(fundsTotal)} of your holdings</div>
              </td>
              <td className="num">{money(fundsTotal)}</td>
              <td className="num">100.0%</td>
            </tr>
          </tfoot>
        </table>
        {result.funds.length > 1 && (
          <Donut
            slices={slices}
            money={money}
            centerValue={formatMoney(fundsTotal, result.currency, { compact: true })}
            centerLabel="in funds"
            legend={false}
            ariaLabel={`Your funds: ${slices.map((slice) => `${slice.label} ${money(slice.value)}`).join(", ")}`}
          />
        )}
      </div>

      <OverlapList funds={result.funds} overlaps={result.overlaps} money={money} />
    </div>
  );
}
