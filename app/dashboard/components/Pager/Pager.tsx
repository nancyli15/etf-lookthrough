// Page buttons under a long table: "Showing 11–20 of 502" and ‹ Prev 1 … 4 5 6 … 51 Next ›.
// The numbering rules are in lib/display/paging/paging.ts, where they're tested.
import { pageCount, pageNumbers } from "@/lib/display/paging/paging";
import "./Pager.css";

type Props = {
  page: number; // The current page, starting at 1.
  first: number; // Row number of the first row shown, like 11.
  last: number; // Row number of the last row shown, like 20.
  totalRows: number;
  label: string; // Names the table for screen readers, like "Companies inside your funds".
  onPage: (page: number) => void;
};

export default function Pager({ page, first, last, totalRows, label, onPage }: Props) {
  const totalPages = pageCount(totalRows);
  return (
    <nav className="pager" aria-label={`${label}, pages`}>
      <span className="muted small" aria-live="polite">
        {totalRows === 0 ? "No matches" : `Showing ${first}–${last} of ${totalRows}`}
      </span>
      {totalPages > 1 && (
        <div className="pager-buttons">
          <button type="button" className="pager-button" onClick={() => onPage(page - 1)} disabled={page === 1}>
            ‹ Prev
          </button>
          {pageNumbers(page, totalPages).map((pageNumber, index) =>
            pageNumber === "…" ? (
              <span key={`gap-${index}`} className="muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={pageNumber}
                type="button"
                className={`pager-button${pageNumber === page ? " current" : ""}`}
                onClick={() => onPage(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
                aria-label={`Page ${pageNumber}`}
              >
                {pageNumber}
              </button>
            ),
          )}
          <button type="button" className="pager-button" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
            Next ›
          </button>
        </div>
      )}
    </nav>
  );
}
