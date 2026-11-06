// Paging and search for the long company tables. No UI, so the rules are tested.

export const PAGE_SIZE = 10;

export function pageCount(rows: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(rows / size));
}

// The rows on one page. A page past the end shows the last page, so shrinking
// the list with a search never leaves an empty table.
export function pageOf<T>(rows: T[], page: number, size = PAGE_SIZE): { rows: T[]; page: number; first: number; last: number } {
  const current = Math.min(Math.max(1, page), pageCount(rows.length, size));
  const start = (current - 1) * size;
  const shown = rows.slice(start, start + size);
  return { rows: shown, page: current, first: shown.length ? start + 1 : 0, last: start + shown.length };
}

// Page buttons: always the first and last, and the pages next to the current one,
// with "…" for the gaps. 51 pages on page 5: 1 … 4 5 6 … 51.
export function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
  // Near either end, show a few more, so the buttons don't jump around.
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}

// The filter buttons above the company table. "Bought directly" is the old direct
// stocks table, "Through funds" the old fund contents table.
export type CompanyView = "all" | "direct" | "funds";

export function inView(view: CompanyView, company: { direct: number; throughFunds: number }): boolean {
  if (view === "direct") return company.direct > 0;
  if (view === "funds") return company.throughFunds > 0;
  return true;
}

// Matches the ticker or any part of the name, ignoring case: "tes" finds Tesla.
export function matchesSearch(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || fields.some((field) => field.toLowerCase().includes(needle));
}
