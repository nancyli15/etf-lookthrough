"""Builds data/fund-data.ts from fund holdings files you downloaded by hand.

Usage: python3 scripts/build_funds.py <folder with the downloaded files>

Standard library only. Keeps each fund's largest holdings and puts the rest in
an "other" share, so the weights still add up to 100%.
"""
import csv
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path

TOP_N = 25
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "fund-data.ts"

FUNDS = [
    ("SPY", "SPDR S&P 500 ETF", "SPY.xlsx", "https://www.ssga.com/us/en/intermediary/etfs/spy"),
    ("XEQT", "iShares Core Equity ETF Portfolio", "XEQT.csv", "https://www.blackrock.com/ca/investors/en/products/309480/"),
    ("XTOT", "iShares Core S&P Total U.S. Stock Market Index ETF", "XTOT.csv", "https://www.blackrock.com/ca/investors/en/products/343519/"),
    ("ITOT", "iShares Core S&P Total U.S. Stock Market ETF", "ITOT.csv", "https://www.ishares.com/us/products/239724/"),
    ("XIC", "iShares Core S&P/TSX Capped Composite Index ETF", "XIC.csv", "https://www.blackrock.com/ca/investors/en/products/239837/"),
    ("XEF", "iShares Core MSCI EAFE IMI Index ETF", "XEF.csv", "https://www.blackrock.com/ca/investors/en/products/251421/"),
    ("XEC", "iShares Core MSCI Emerging Markets IMI Index ETF", "XEC.csv", "https://www.blackrock.com/ca/investors/en/products/251423/"),
    ("XQQ", "iShares NASDAQ 100 Index ETF (CAD-Hedged)", "XQQ.csv", "https://www.blackrock.com/ca/investors/en/"),
]


def percent(text):
    return float(text.replace(",", "")) / 100


def read_ishares(path):
    """Returns (as-of date, rows), or None if the file isn't a real holdings CSV."""
    rows = list(csv.reader(path.read_text(encoding="utf-8-sig").splitlines()))
    as_of = next((r[1] for r in rows if r and r[0] == "Fund Holdings as of"), None)
    headers = [i for i, r in enumerate(rows) if r and r[0] == "Ticker"]
    if not as_of or not headers:
        return None

    # XEQT's file has a second table, BlackRock's own look-through. Stop before
    # it, because we want what the fund directly holds.
    end = headers[1] if len(headers) > 1 else len(rows)
    header = rows[headers[0]]
    table = [dict(zip(header, r)) for r in rows[headers[0] + 1 : end] if len(r) > 5]
    # Equity only: cash, futures and FX lines fall into "other".
    holdings = [
        {"symbol": r["Ticker"], "name": r["Name"], "exchange": r["Exchange"], "weight": percent(r["Weight (%)"])}
        for r in table
        if r["Asset Class"] == "Equity" and r["Ticker"] not in ("", "-")
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
    top = sorted(holdings, key=lambda h: -h["weight"])[:TOP_N]
    for h in top:
        h["weight"] = round(h["weight"], 6)
    return {
        "symbol": symbol,
        "name": name,
        "asOf": as_of,
        "source": source,
        "holdings": top,
        "other": round(1 - sum(h["weight"] for h in top), 6),
    }


def main():
    folder = Path(sys.argv[1])
    funds = []
    for symbol, name, filename, source in FUNDS:
        path = folder / filename
        fund = build(symbol, name, path, source) if path.exists() and path.stat().st_size else None
        if fund:
            funds.append(fund)
            print(f"{symbol}: {fund['asOf']}, {len(fund['holdings'])} holdings, other {fund['other']:.4f}")
        else:
            print(f"{symbol}: SKIPPED, no valid file at {path.name}", file=sys.stderr)

    body = ",\n".join(f"  {json.dumps(f['symbol'])}: {json.dumps(f, indent=2, ensure_ascii=False)}" for f in funds)
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(
        "// Generated by scripts/build_funds.py from the fund providers' holdings files.\n"
        "// Don't edit by hand: download new files and run the script again.\n"
        'import type { Fund } from "./fund-types";\n\n'
        f"export const FUND_DATA: Record<string, Fund> = {{\n{body},\n}};\n"
    )


main()
