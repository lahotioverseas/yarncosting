"""Google Sheet URLs and CSV parsers for the Yarn, FOB and Freight master sheets.
Port of the parsing half of frontend/src/lib/googleSheetService.ts."""
from __future__ import annotations

import math
import re
from typing import Any

from .jsutil import js_parse_float, js_trim

DEFAULT_MASTER_SHEET_ID = "1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE"

GOOGLE_SHEET_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/edit?gid=177573931#gid=177573931"
GOOGLE_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/export?format=csv&gid=177573931"

GOOGLE_FOB_SHEET_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/edit?gid=1401052388#gid=1401052388"
GOOGLE_FOB_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/export?format=csv&gid=1401052388"

GOOGLE_FREIGHT_SHEET_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/edit?gid=1549189100#gid=1549189100"
GOOGLE_FREIGHT_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{DEFAULT_MASTER_SHEET_ID}/export?format=csv&gid=1549189100"

_WS_RE = re.compile(r"\s+")
_NON_NUMERIC_RE = re.compile(r"[^0-9.]")
_DIGIT_RE = re.compile(r"\d")


def _at(row: list[str], idx: int) -> str | None:
    """row[idx] with JS semantics (negative / out-of-range -> undefined)."""
    if idx < 0 or idx >= len(row):
        return None
    return row[idx]


def _collapse(s: str | None) -> str | None:
    if s is None:
        return None
    return js_trim(_WS_RE.sub(" ", s))


def _price(raw: str | None) -> float | None:
    clean = _NON_NUMERIC_RE.sub("", raw) if raw else ""
    if not clean:
        return None
    num = js_parse_float(clean)
    if math.isnan(num) or num <= 0:
        return None
    return int(num) if num.is_integer() else num


def parse_csv(text: str) -> list[list[str]]:
    """CSV parser handling quotes, escaped quotes, commas and multi-line cells. Blank rows are dropped."""
    lines: list[list[str]] = []
    row: list[str] = []
    in_quotes = False
    field = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch == '"':
            if in_quotes and nxt == '"':
                field.append('"')
                i += 1
            else:
                in_quotes = not in_quotes
        elif ch == "," and not in_quotes:
            row.append(js_trim("".join(field)))
            field = []
        elif ch in ("\r", "\n") and not in_quotes:
            if ch == "\r" and nxt == "\n":
                i += 1
            row.append(js_trim("".join(field)))
            if any(c != "" for c in row):
                lines.append(row)
            row = []
            field = []
        else:
            field.append(ch)
        i += 1

    if field or row:
        row.append(js_trim("".join(field)))
        if any(c != "" for c in row):
            lines.append(row)
    return lines


def parse_google_sheet_yarn_csv(raw_csv: str) -> dict[str, Any]:
    rows = parse_csv(raw_csv)
    records: list[dict[str, Any]] = []

    flat_header_idx = -1
    for i, r in enumerate(rows):
        low = [c.lower() for c in r]
        has_count = any("count" in c or "yarn count" in c for c in low)
        has_quality = any("quality" in c for c in low)
        has_price = any("price" in c or "ex mill" in c or "ex-mill" in c for c in low)
        if has_count and has_quality and has_price:
            flat_header_idx = i
            break

    if flat_header_idx != -1:
        header = [c.lower() for c in rows[flat_header_idx]]
        count_col = next((j for j, c in enumerate(header) if "count" in c), -1)
        qual_col = next((j for j, c in enumerate(header) if "quality" in c), -1)
        price_col = next((j for j, c in enumerate(header) if "price" in c or "ex mill" in c or "ex-mill" in c), -1)
        loc_col = next((j for j, c in enumerate(header) if "factory" in c or "location" in c), -1)

        for i in range(flat_header_idx + 1, len(rows)):
            r = rows[i]
            count = _collapse(_at(r, count_col))
            qual = _collapse(_at(r, qual_col))
            price = _price(_at(r, price_col))
            loc = _collapse(_at(r, loc_col)) if loc_col != -1 else ""
            if count and qual:
                records.append({
                    "yarnCount": count,
                    "quality": qual,
                    "exMillPrice": price,
                    "factoryLocation": loc or "Factory Location not available.",
                    "rawRow": i + 1,
                })
    else:
        current_category = "General"
        active_qualities: list[dict[str, Any]] = []

        for i, row in enumerate(rows):
            first_cell = js_trim(row[0] if row else "")
            has_factory_loc = any("factory location" in c.lower() or "location" in c.lower() for c in row)

            filled = [c for c in row if c and js_trim(c) != ""]
            if (
                len(filled) == 1
                and not first_cell.upper().startswith("NE")
                and "/" not in first_cell
                and not has_factory_loc
            ):
                current_category = _collapse(filled[0])
                active_qualities = []
                continue

            if has_factory_loc:
                active_qualities = []
                for c in range(1, len(row)):
                    cell = js_trim(row[c]) if row[c] is not None else ""
                    if cell and "factory" not in cell.lower() and "location" not in cell.lower():
                        loc_col = -1
                        if c + 1 < len(row):
                            loc_col = c + 1
                        active_qualities.append({
                            "qualityName": _collapse(cell),
                            "priceCol": c,
                            "locCol": loc_col,
                        })
                continue

            if first_cell and active_qualities:
                fl = first_cell.lower()
                is_header_like = (
                    ("yarn" in fl or "count" in fl or "quality" in fl or "category" in fl)
                    and "/" not in first_cell
                    and not _DIGIT_RE.search(first_cell)
                )
                if not is_header_like:
                    normalized_count = _collapse(first_cell)
                    for qual in active_qualities:
                        price_raw = _at(row, qual["priceCol"])
                        price_raw = js_trim(price_raw) if price_raw is not None else None
                        loc_raw = _collapse(_at(row, qual["locCol"])) if qual["locCol"] != -1 else ""
                        price = _price(price_raw)
                        records.append({
                            "yarnCount": normalized_count,
                            "quality": qual["qualityName"],
                            "category": current_category,
                            "exMillPrice": price,
                            "factoryLocation": loc_raw or "Factory Location not available.",
                            "rawRow": i + 1,
                        })

    duplicates_map: dict[str, dict[str, Any]] = {}
    for r in records:
        if r["exMillPrice"] is None:
            continue
        key = f"{r['yarnCount'].upper()}__{r['quality'].upper()}"
        existing = duplicates_map.get(key)
        if existing is None:
            duplicates_map[key] = {
                "yarnCount": r["yarnCount"],
                "quality": r["quality"],
                "count": 1,
                "prices": [r["exMillPrice"]],
                "locations": [r["factoryLocation"]],
            }
        else:
            existing["count"] += 1
            if r["exMillPrice"] not in existing["prices"]:
                existing["prices"].append(r["exMillPrice"])
            if r["factoryLocation"] not in existing["locations"]:
                existing["locations"].append(r["factoryLocation"])

    duplicates = [d for d in duplicates_map.values() if d["count"] > 1]

    unique_counts: list[str] = []
    for r in records:
        if r["yarnCount"] not in unique_counts:
            unique_counts.append(r["yarnCount"])

    return {"records": records, "uniqueCounts": unique_counts, "duplicates": duplicates}


def parse_google_sheet_fob_csv(raw_csv: str) -> dict[str, Any]:
    rows = parse_csv(raw_csv)
    records: list[dict[str, Any]] = []
    locations: list[str] = []
    if not rows:
        return {"records": records, "locations": locations}

    loc_col, price_col, start_row = 0, 1, 0
    first = [c.lower() for c in rows[0]]
    loc_header = next((j for j, c in enumerate(first) if "loc" in c or "port" in c or "city" in c or "state" in c), -1)
    price_header = next(
        (j for j, c in enumerate(first) if "price" in c or "fob" in c or "amount" in c or "cost" in c or "rate" in c), -1
    )
    if loc_header != -1:
        loc_col = loc_header
        if price_header != -1:
            price_col = price_header
        start_row = 1

    for i in range(start_row, len(rows)):
        r = rows[i]
        if not r:
            continue
        loc = _collapse(_at(r, loc_col))
        if not loc:
            continue
        price_raw = _at(r, price_col)
        price = _price(js_trim(price_raw) if price_raw is not None else None)
        records.append({"location": loc, "price": price, "rawRow": i + 1})
        if loc not in locations:
            locations.append(loc)

    return {"records": records, "locations": locations}


_FREIGHT_LABELS = {"destination port", "destination", "port", "freight", "ocean freight", "port of discharge"}


def parse_google_sheet_freight_csv(raw_csv: str) -> dict[str, Any]:
    rows = parse_csv(raw_csv)
    records: list[dict[str, Any]] = []
    destinations: list[str] = []
    if not rows:
        return {"records": records, "destinations": destinations}

    dest_col, amount_col, start_row = 0, 1, 0
    for i in range(min(len(rows), 6)):
        low = [js_trim(c.lower()) for c in rows[i]]
        dest_idx = next(
            (j for j, c in enumerate(low) if "destination" in c or "port" in c or "dest" in c or "pod" in c or "discharge" in c),
            -1,
        )
        amt_idx = next(
            (
                j
                for j, c in enumerate(low)
                if "amount" in c or "rate" in c or "price" in c or "cost" in c or "freight" in c or "usd" in c or "fcl" in c
            ),
            -1,
        )
        if dest_idx != -1:
            dest_col = dest_idx
            amount_col = amt_idx if (amt_idx != -1 and amt_idx != dest_idx) else dest_idx + 1
            start_row = i + 1
            break

    for i in range(start_row, len(rows)):
        r = rows[i]
        if not r:
            continue
        dest = _collapse(_at(r, dest_col))
        if not dest:
            continue
        if dest.lower() in _FREIGHT_LABELS:
            continue
        amount_raw = _at(r, amount_col)
        amount = _price(js_trim(amount_raw) if amount_raw is not None else None)
        records.append({"destination": dest, "amount": amount, "rawRow": i + 1})
        if not any(js_trim(d).upper() == dest.upper() for d in destinations):
            destinations.append(dest)

    return {"records": records, "destinations": destinations}


def is_html_response(text: str) -> bool:
    s = js_trim(text).lower()
    return s.startswith("<!doctype") or s.startswith("<html")
