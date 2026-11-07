// Page buttons under a long table: "Showing 11–20 of 502" and ‹ Prev 1 … 4 5 6 … 51 Next ›.
// The numbering rules are in lib/display/paging/paging.ts, where they're tested.
import { pageCount, pageNumbers } from "@/lib/display/paging/paging";
import "./Pager.css";

type Props = {
  page: number;
  first: number;
  last: number;
  total: number;
  label: string; // Names the table for screen readers, like "Companies inside your funds".
  onPage: (page: number) => void;
};

export default function Pager({ page, first, last, total, label, onPage }: Props) {
  const pages = pageCount(total);
  return (
    <nav className="pager" aria-label={`${label}, pages`}>
      <span className="muted small" aria-live="polite">
        {total === 0 ? "No matches" : `Showing ${first}–${last} of ${total}`}
      </span>
      {pages > 1 && (
        <div className="pager-buttons">
          <button type="button" className="pager-button" onClick={() => onPage(page - 1)} disabled={page === 1}>
            ‹ Prev
          </button>
          {pageNumbers(page, pages).map((number, index) =>
            number === "…" ? (
              <span key={`gap-${index}`} className="muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                className={`pager-button${number === page ? " current" : ""}`}
                onClick={() => onPage(number)}
                aria-current={number === page ? "page" : undefined}
                aria-label={`Page ${number}`}
              >
                {number}
              </button>
            ),
          )}
          <button type="button" className="pager-button" onClick={() => onPage(page + 1)} disabled={page === pages}>
            Next ›
          </button>
        </div>
      )}
    </nav>
  );
}
