"""Builds data/fund-data.ts from fund holdings files you downloaded by hand.

Usage: python3 scripts/build_funds.py <folder with the downloaded files>

Name each file after its fund: SPY.xlsx, and XEQT.csv or XEQT.xls for iShares.
iShares offers a holdings CSV and a "_fund.xls" spreadsheet; both work.

Standard library only. Keeps every stock each fund holds, largest first. Cash,
futures and currency lines go in an "other" share, so the weights still add up
to 100%.
"""
import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "fund-data.ts"

# (symbol, name, source). The file is <symbol> plus .xlsx, .csv or .xls.
FUNDS = [
    ("SPY", "SPDR S&P 500 ETF", "https://www.ssga.com/us/en/intermediary/etfs/spy"),
    # BlackRock's XEQT spreadsheet is already looked through: it lists the companies
    # inside XEQT's funds, not the funds themselves.
    ("XEQT", "iShares Core Equity ETF Portfolio", "https://www.blackrock.com/ca/investors/en/products/309480/"),
    ("XTOT", "iShares Core S&P Total U.S. Stock Market Index ETF", "https://www.blackrock.com/ca/investors/en/products/343519/"),
    ("ITOT", "iShares Core S&P Total U.S. Stock Market ETF", "https://www.ishares.com/us/products/239724/"),
    ("XIC", "iShares Core S&P/TSX Capped Composite Index ETF", "https://www.blackrock.com/ca/investors/en/products/239837/"),
    ("XEF", "iShares Core MSCI EAFE IMI Index ETF", "https://www.blackrock.com/ca/investors/en/products/251421/"),
    ("XEC", "iShares Core MSCI Emerging Markets IMI Index ETF", "https://www.blackrock.com/ca/investors/en/products/251423/"),
    ("XQQ", "iShares NASDAQ 100 Index ETF (CAD-Hedged)", "https://www.blackrock.com/ca/investors/en/"),
]
EXTENSIONS = (".xlsx", ".csv", ".xls")


def percent(text):
    return float(text.replace(",", "")) / 100


def spreadsheet_rows(path):
    """Rows of the Holdings sheet in iShares' "_fund.xls", an old Excel XML format."""
    ns = "{urn:schemas-microsoft-com:office:spreadsheet}"
    text = path.read_text(encoding="utf-8-sig").lstrip("\ufeff")
    # Some files have a bare "&" in a name, like "AT&T", which isn't valid XML.
    text = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#)", "&amp;", text)
    sheets = [w for w in ET.fromstring(text).iter(ns + "Worksheet") if w.get(ns + "Name") == "Holdings"]
    if not sheets:
        return []
    return [
        [(cell.find(ns + "Data").text or "") if cell.find(ns + "Data") is not None else "" for cell in row.iter(ns + "Cell")]
        for row in sheets[0].iter(ns + "Row")
    ]


def is_stock(row):
    # US files say so in "Asset Class". Canadian files have no such column, and
    # mark cash, futures and FX with the sector "Cash and/or Derivatives".
    if "Asset Class" in row:
        return row["Asset Class"] == "Equity"
    return row.get("Sector") != "Cash and/or Derivatives"


def read_ishares(path):
    """Returns (as-of date, rows), or None if the file isn't a real holdings file."""
    if path.suffix == ".xls":
        rows = spreadsheet_rows(path)
    else:
        rows = list(csv.reader(path.read_text(encoding="utf-8-sig").splitlines()))
    as_of = next((r[1] for r in rows if len(r) > 1 and r[0] == "Fund Holdings as of"), None)
    headers = [i for i, r in enumerate(rows) if r and r[0] == "Ticker"]
    if not as_of or not headers:
        return None

    # XEQT's CSV has a second table, BlackRock's own look-through. Stop before
    # it, because we want what the fund directly holds.
    end = headers[1] if len(headers) > 1 else len(rows)
    header = rows[headers[0]]
    table = [dict(zip(header, r)) for r in rows[headers[0] + 1 : end] if len(r) > 5]
    # Stocks only: cash, futures and FX lines fall into "other".
    holdings = [
        {"symbol": r["Ticker"], "name": r["Name"], "exchange": r["Exchange"], "weight": percent(r["Weight (%)"])}
        for r in table
        if is_stock(r) and r["Ticker"] not in ("", "-") and re.fullmatch(r"-?[\d,.]+", r["Weight (%)"])
    ]
    return datetime.strptime(as_of, "%b %d, %Y").date().isoformat(), holdings


def read_spdr(path):
    """Returns (as-of date, rows) from SPDR's .xlsx, or None if it isn't readable."""
    tag = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    book = zipfile.ZipFile(path)
    strings = ["".join(t.text or "" for t in si.iter(tag + "t")) for si in ET.fromstring(book.read("xl/sharedStrings.xml"))]

    rows = []
    for row in ET.fromstring(book.read("xl/worksheets/sheet1.xml")).iter(tag + "row"):
        cells = []
        for cell in row:
            value = cell.find(tag + "v")
            if value is None:
                cells.append("")
            else:
                cells.append(strings[int(value.text)] if cell.get("t") == "s" else value.text)
        rows.append(cells)

    as_of = next(r[1] for r in rows if r and r[0] == "Holdings:").replace("As of ", "")
    start = next(i for i, r in enumerate(rows) if r and r[0] == "Name")
    # SPDR's file has no exchange column, so `exchange` is left out for SPY.
    holdings = [
        {"symbol": r[1], "name": r[0], "weight": percent(r[4])}
        for r in rows[start + 1 :]
        if len(r) > 4 and r[1] not in ("", "-") and r[4]
    ]
    return datetime.strptime(as_of, "%d-%b-%Y").date().isoformat(), holdings


def build(symbol, name, path, source):
    result = read_spdr(path) if path.suffix == ".xlsx" else read_ishares(path)
    if result is None:
        return None
    as_of, holdings = result
    # Every holding, not just the largest: overlap and company totals need the
    # full list to be right, not a minimum.
    ranked = sorted(holdings, key=lambda h: -h["weight"])
    for h in ranked:
        h["weight"] = round(h["weight"], 6)
    # Files list placeholders at 0%, like SPY's "CONTRA HOLOGIC". They hold nothing.
    ranked = [h for h in ranked if h["weight"] > 0]
    return {
        "symbol": symbol,
        "name": name,
        "asOf": as_of,
        "source": source,
        "holdings": ranked,
        "other": round(1 - sum(h["weight"] for h in ranked), 6),
    }


def format_fund(fund):
    """One fund, with one holding per line: about 19,000 lines instead of 113,000,
    so the file is smaller and a refresh shows up as one changed line per holding."""
    dump = lambda value: json.dumps(value, ensure_ascii=False)
    fields = "".join(f"    {dump(key)}: {dump(value)},\n" for key, value in fund.items() if key != "holdings")
    holdings = ",\n".join(f"      {dump(holding)}" for holding in fund["holdings"])
    return f"  {dump(fund['symbol'])}: {{\n{fields}    \"holdings\": [\n{holdings}\n    ]\n  }}"


def main():
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    allow_missing = "--allow-missing" in sys.argv
    if len(args) != 1:
        sys.exit("Usage: python3 scripts/build_funds.py <folder> [--allow-missing]")
    folder = Path(args[0]).expanduser()
    if not folder.is_dir():
        sys.exit(f"No folder at {folder}. Nothing was written.")

    funds = []
    skipped = []
    for symbol, name, source in FUNDS:
        path = next((folder / (symbol + ext) for ext in EXTENSIONS if (folder / (symbol + ext)).exists()), folder / symbol)
        fund = build(symbol, name, path, source) if path.exists() and path.stat().st_size else None
        if fund:
            funds.append(fund)
            print(f"{symbol}: {fund['asOf']}, {len(fund['holdings'])} holdings, other {fund['other']:.4f}")
        else:
            skipped.append(symbol)
            print(f"{symbol}: SKIPPED, no valid {symbol}.xlsx, .csv or .xls", file=sys.stderr)

    # Writing would delete the skipped funds from fund-data.ts, so stop unless asked.
    if not funds or (skipped and not allow_missing):
        sys.exit(
            f"Not written: {len(skipped)} fund(s) skipped. Skipped funds would be removed from "
            f"{OUTPUT.name}. Fix the files, or run again with --allow-missing to drop them."
        )

    body = ",\n".join(format_fund(f) for f in funds)
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(
        "// Generated by scripts/build_funds.py from the fund providers' holdings files.\n"
        "// Don't edit by hand: download new files and run the script again.\n"
        'import type { Fund } from "./fund-types";\n\n'
        "export const FUND_DATA_IS_SAMPLE = false;\n\n"
        f"export const FUND_DATA: Record<string, Fund> = {{\n{body},\n}};\n"
    )


main()
