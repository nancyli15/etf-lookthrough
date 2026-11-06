"use client";
// One table for every company you own, directly or through funds. It replaces
// the bar chart, the "Where it comes from" card and three separate tables:
//   - each row's bar is the old chart: blue for what you bought, orange via funds
//   - the line under the bar replaces the Direct and Through funds columns
//   - the filter buttons replace the direct-stocks and fund-contents tables, and
//     one button per fund shows just that fund's companies, largest in it first
//   - clicking a company opens its dropdown (CompanyDetails)
import { Fragment, useEffect, useState } from "react";
import { formatMoney, percentText } from "../../lib/format";
import type { CompanyExposure } from "../../lib/lookthrough";
import { shortName } from "../../lib/names";
import { fundView, inView, matchesSearch, pageOf, sortForView, type CompanyView } from "../../lib/paging";
import type { Report } from "../../lib/report";
import CompanyDetails from "./CompanyDetails";
import Pager from "./Pager";

const VIEWS: { view: CompanyView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "direct", label: "Bought directly" },
  { view: "funds", label: "Through funds" },
];

type Props = {
  report: Report;
  money: (value: number, currency?: string) => string;
  // The view lives in LookThrough, so clicking a fund's name in the Funds card can set it.
  view: CompanyView;
  onViewChange: (view: CompanyView) => void;
};

function sumOf(companies: CompanyExposure[], valueOf: (company: CompanyExposure) => number): number {
  return companies.reduce((sum, company) => sum + valueOf(company), 0);
}

export default function CompanyTable({ report, money, view, onViewChange }: Props) {
  const { result } = report;
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  // Open dropdowns stay open across pages, so you can page away and come back.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  // Back to page 1 whenever the view changes, including from the Funds card.
  useEffect(() => setPageNumber(1), [view]);

  const matches = sortForView(
    view,
    result.companies.filter(
      (company) => inView(view, company) && matchesSearch(query, company.symbol, company.name, shortName(company.name)),
    ),
  );
  // All, Bought directly, Through funds, then one button per fund you hold.
  const views = [...VIEWS, ...result.funds.map((fund) => ({ view: fundView(fund.symbol), label: fund.symbol }))];
  const page = pageOf(matches, pageNumber);
  // Bars are scaled to your biggest company, on every page, so they compare across pages.
  const largest = result.companies[0]?.total || 1;
  // Totals cover every company, whatever the page, filter or search, so the money never seems to move.
  const directTotal = sumOf(result.companies, (company) => company.direct);
  const fundsTotal = sumOf(result.companies, (company) => company.throughFunds);

  // Whole dollars read faster in the line under each bar. Small amounts keep their cents.
  function brief(value: number): string {
    return value >= 100 ? formatMoney(value, result.currency, { whole: true }) : money(value);
  }

  function toggleOpen(key: string) {
    const next = new Set(openKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenKeys(next);
  }

  function changeView(next: CompanyView) {
    onViewChange(next);
    setPageNumber(1);
  }

  if (result.companies.length === 0) return null;

  return (
    <div className="card" id="companies">
      <div className="table-header">
        <h2>Your companies</h2>
        <input
          type="search"
          className="search"
          placeholder="Search companies"
          aria-label="Search all companies"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPageNumber(1);
          }}
        />
      </div>

      <div className="table-tools">
        <div className="views" role="group" aria-label="Show companies">
          {views.map((option) => (
            <button
              key={option.view}
              type="button"
              className={`view-button${view === option.view ? " current" : ""}`}
              aria-pressed={view === option.view}
              onClick={() => changeView(option.view)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="legend small" aria-hidden="true">
          <span>
            <i className="swatch direct" /> You bought
          </span>
          <span>
            <i className="swatch funds" /> Via funds
          </span>
        </div>
      </div>

      <table className="companies">
        {/* Fixed column widths. Without them, opening a dropdown (one wide cell across
            all four columns) made the browser re-share the widths, and every bar shifted. */}
        <colgroup>
          <col className="col-company" />
          <col className="col-sources" />
          <col className="col-total" />
          <col className="col-percent" />
        </colgroup>
        <thead>
          <tr>
            <th>Company</th>
            <th>Where it comes from</th>
            <th className="num">Total</th>
            <th className="num">% of holdings</th>
          </tr>
        </thead>
        <tbody>
          {page.rows.map((company) => {
            const isOpen = openKeys.has(company.key);
            const sources = `${company.direct > 0 ? `${money(company.direct)} you bought` : ""}${
              company.direct > 0 && company.throughFunds > 0 ? ", " : ""
            }${company.throughFunds > 0 ? `${money(company.throughFunds)} via ${company.viaFunds.join(" and ")}` : ""}`;
            return (
              <Fragment key={company.key}>
                <tr className={isOpen ? "selected" : undefined}>
                  <td>
                    <button className="link" type="button" onClick={() => toggleOpen(company.key)} aria-expanded={isOpen}>
                      {shortName(company.name)} <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                    </button>{" "}
                    <span className="muted">{company.symbol}</span>
                  </td>
                  <td className="sources" title={sources}>
                    <span className="bar-track" role="img" aria-label={sources}>
                      {company.direct > 0 && (
                        <span className="bar direct" style={{ width: `${(company.direct / largest) * 100}%` }} />
                      )}
                      {company.throughFunds > 0 && (
                        <span className="bar funds" style={{ width: `${(company.throughFunds / largest) * 100}%` }} />
                      )}
                    </span>
                    <span className="source-line muted small" aria-hidden="true">
                      {company.direct > 0 && (
                        <span>
                          <i className="swatch direct" /> {brief(company.direct)} you bought
                        </span>
                      )}
                      {company.throughFunds > 0 && (
                        <span>
                          <i className="swatch funds" /> {brief(company.throughFunds)} via {company.viaFunds.join(", ")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="num">{money(company.total)}</td>
                  <td className="num">{percentText(company.percent)}</td>
                </tr>
                {isOpen && (
                  <tr className="open-row">
                    <td colSpan={4}>
                      <CompanyDetails
                        company={company}
                        funds={result.funds}
                        holdingsTotal={result.total}
                        activities={report.recentActivity[company.symbol.toUpperCase()] ?? []}
                        activitySince={report.activitySince}
                        activityNotLoaded={report.activityNotLoaded}
                        money={money}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <Pager
        page={page.page}
        first={page.first}
        last={page.last}
        total={matches.length}
        label="Your companies"
        onPage={setPageNumber}
      />
      <p className="totals small">
        In all {result.companies.length.toLocaleString()} companies:{" "}
        {directTotal > 0 && (
          <span>
            <i className="swatch direct" aria-hidden="true" /> {money(directTotal)} you bought
          </span>
        )}
        {fundsTotal > 0 && (
          <span>
            <i className="swatch funds" aria-hidden="true" /> {money(fundsTotal)} via funds
          </span>
        )}
        <strong>
          {money(directTotal + fundsTotal)} in companies ({percentText(result.total ? (directTotal + fundsTotal) / result.total : 0)} of
          your holdings)
        </strong>
      </p>
      {/* What the other part of holdings is (cash inside funds, crypto) is in the
          "What's inside your holdings" donut at the top, not repeated here. */}
    </div>
  );
}
