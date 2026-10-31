"""Fetch the three Google Sheets as CSV, diff them against the stored prices
(preview) or publish them as today's prices (unlocks the 12:00 AM lock)."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from urllib.parse import urlsplit

import httpx
from fastapi.concurrency import run_in_threadpool

from . import persistence, pricing_store
from .jsutil import is_nullish, js_number, js_round
from .seeds import default_pricing_snapshot
from .sheet_parser import (
    GOOGLE_FOB_SHEET_CSV_URL,
    GOOGLE_FOB_SHEET_URL,
    GOOGLE_FREIGHT_SHEET_CSV_URL,
    GOOGLE_FREIGHT_SHEET_URL,
    GOOGLE_SHEET_CSV_URL,
    GOOGLE_SHEET_URL,
    is_html_response,
    parse_google_sheet_fob_csv,
    parse_google_sheet_freight_csv,
    parse_google_sheet_yarn_csv,
)

log = logging.getLogger(__name__)

HTML_INSTEAD_OF_CSV = (
    'Google Sheet URL returned HTML instead of CSV data. Please verify the Google Sheet URL and ensure sharing is set '
    'to "Anyone with the link can view".'
)

DEFAULT_SHEET_URLS: dict[str, str] = {
    "yarnViewUrl": GOOGLE_SHEET_URL,
    "yarnCsvUrl": GOOGLE_SHEET_CSV_URL,
    "fobViewUrl": GOOGLE_FOB_SHEET_URL,
    "fobCsvUrl": GOOGLE_FOB_SHEET_CSV_URL,
    "freightViewUrl": GOOGLE_FREIGHT_SHEET_URL,
    "freightCsvUrl": GOOGLE_FREIGHT_SHEET_CSV_URL,
}


def get_configured_urls() -> dict[str, str]:
    """Sheet URLs (defaults + Admin overrides saved via /api/google-sheet/config-urls)."""
    saved = persistence.get_setting("sheet_urls", {}) or {}
    return {**DEFAULT_SHEET_URLS, **saved}


def update_configured_urls(patch: dict[str, Any]) -> dict[str, str]:
    saved = persistence.get_setting("sheet_urls", {}) or {}
    saved.update(patch)
    persistence.set_setting("sheet_urls", saved)
    return {**DEFAULT_SHEET_URLS, **saved}


class SheetReturnedHtmlError(Exception):
    pass


class InvalidSheetUrlError(Exception):
    pass


ALLOWED_SHEET_HOSTS = {"docs.google.com"}


def check_sheet_url(url: str) -> str:
    """Prices may only be read from Google Sheets (blocks pointing the server at arbitrary URLs)."""
    parts = urlsplit(url or "")
    if parts.scheme != "https" or (parts.hostname or "").lower() not in ALLOWED_SHEET_HOSTS:
        raise InvalidSheetUrlError(f"Only Google Sheets links (https://docs.google.com/...) are allowed: {url}")
    return url


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str:
    # Google's CSV export follows redirects; no-cache so a just-made edit is picked up
    res = await client.get(url, headers={"Cache-Control": "no-cache"})
    return res.text


async def fetch_and_parse_sheets(body: dict[str, Any]) -> tuple[dict, dict, dict]:
    urls = await run_in_threadpool(get_configured_urls) if not (
        body.get("yarnCsvUrl") and body.get("fobCsvUrl") and body.get("freightCsvUrl")
    ) else {}
    yarn_url = body.get("yarnCsvUrl") or urls["yarnCsvUrl"]
    fob_url = body.get("fobCsvUrl") or urls["fobCsvUrl"]
    freight_url = body.get("freightCsvUrl") or urls["freightCsvUrl"]

    for u in (yarn_url, fob_url, freight_url):
        check_sheet_url(u)
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0), follow_redirects=True) as client:
        text_yarn, text_fob, text_freight = await asyncio.gather(
            _fetch_text(client, yarn_url), _fetch_text(client, fob_url), _fetch_text(client, freight_url)
        )
    if is_html_response(text_yarn) or is_html_response(text_fob) or is_html_response(text_freight):
        raise SheetReturnedHtmlError(HTML_INSTEAD_OF_CSV)
    return (
        parse_google_sheet_yarn_csv(text_yarn),
        parse_google_sheet_fob_csv(text_fob),
        parse_google_sheet_freight_csv(text_freight),
    )


def _low(v: Any) -> str:
    return v.lower().strip() if isinstance(v, str) else ""


def _old_value(prev: dict | None, field: str) -> float | None:
    if prev is None or is_nullish(prev.get(field, None)):
        return None
    return js_number(prev[field])


def _diff_entry(category: str, product: str, old: float | None, new: float | None) -> dict[str, Any] | None:
    if new is None or new == old:
        return None
    pct = js_round((abs(new - old) / old) * 1000) / 10 if (old is not None and old > 0) else 100
    return {
        "category": category, "product": product, "oldPrice": old, "newPrice": new,
        "percentChange": pct, "highlight": pct > 25,
    }


async def preview_sync(body: dict[str, Any]) -> dict[str, Any]:
    parsed_yarn, parsed_fob, parsed_freight = await fetch_and_parse_sheets(body)
    store = await run_in_threadpool(pricing_store.get_daily_pricing_store)
    sheets = store.get("sheets") or {}
    yarn_rows = (sheets.get("yarn") or {}).get("rows") or []
    fob_rows = (sheets.get("fob") or {}).get("rows") or []
    freight_rows = (sheets.get("freight") or {}).get("rows") or []

    changes: list[dict[str, Any]] = []
    for r in parsed_yarn["records"]:
        if not r.get("yarnCount") or not r.get("quality"):
            continue
        prev = next((p for p in yarn_rows if _low(p.get("yarnCount")) == _low(r["yarnCount"]) and _low(p.get("quality")) == _low(r["quality"])), None)
        old = _old_value(prev, "exMillPrice")
        new = js_number(r["exMillPrice"]) if (r["exMillPrice"] is not None and r["exMillPrice"] > 0) else old
        entry = _diff_entry("Yarn", f"{r['yarnCount']} {r['quality']}", old, new)
        if entry:
            changes.append(entry)

    for r in parsed_fob["records"]:
        if not r.get("location"):
            continue
        prev = next((p for p in fob_rows if _low(p.get("location")) == _low(r["location"])), None)
        old = _old_value(prev, "price")
        new = js_number(r["price"]) if (r["price"] is not None and r["price"] > 0) else old
        entry = _diff_entry("FOB", r["location"], old, new)
        if entry:
            changes.append(entry)

    for r in parsed_freight["records"]:
        if not r.get("destination"):
            continue
        prev = next((p for p in freight_rows if _low(p.get("destination")) == _low(r["destination"])), None)
        old = _old_value(prev, "amount")
        new = js_number(r["amount"]) if (r["amount"] is not None and r["amount"] > 0) else old
        entry = _diff_entry("Freight", r["destination"], old, new)
        if entry:
            changes.append(entry)

    count = len(changes)
    return {
        "success": True,
        "count": count,
        "changes": changes,
        "hasLargeDiff": count > 10 or any(c["highlight"] for c in changes),
        "message": "No price changes – prices stay the same" if count == 0 else f"{count} price change(s) detected",
        "isDefaultSnapshot": False,
    }


def _keep(new_val: Any, prev: dict | None, field: str) -> Any:
    if new_val is not None and new_val > 0:
        return new_val
    return (prev or {}).get(field) if not is_nullish((prev or {}).get(field)) else None


async def sync_and_publish(body: dict[str, Any], confirmed_by: str) -> dict[str, Any]:
    """Pull the latest Google Sheet prices, publish them for today and unlock calculations."""
    parsed_yarn, parsed_fob, parsed_freight = await fetch_and_parse_sheets(body)
    store = await run_in_threadpool(pricing_store.get_daily_pricing_store)
    sheets = store.get("sheets") or {}
    default_sheets = default_pricing_snapshot()["sheets"]

    def existing_rows(key: str) -> list[dict[str, Any]]:
        rows = (sheets.get(key) or {}).get("rows")
        return rows if rows is not None else default_sheets[key]["rows"]

    ex_yarn, ex_fob, ex_freight = existing_rows("yarn"), existing_rows("fob"), existing_rows("freight")

    def yarn_row(idx: int, r: dict[str, Any]) -> dict[str, Any]:
        prev = next(
            (p for p in ex_yarn
             if isinstance(p.get("yarnCount"), str) and p["yarnCount"].lower() == r["yarnCount"].lower()
             and isinstance(p.get("quality"), str) and p["quality"].lower() == r["quality"].lower()),
            None,
        )
        return {
            "id": f"yarn_row_{idx + 1}",
            "yarnCount": r["yarnCount"],
            "quality": r["quality"],
            "category": r.get("category") or (prev or {}).get("category") or "General",
            "exMillPrice": _keep(r["exMillPrice"], prev, "exMillPrice"),
            "factoryLocation": r.get("factoryLocation") or (prev or {}).get("factoryLocation") or "Gujrat",
        }

    def fob_row(idx: int, r: dict[str, Any]) -> dict[str, Any]:
        prev = next((p for p in ex_fob if _low(p.get("location")) == _low(r["location"])), None)
        return {"id": f"fob_row_{idx + 1}", "location": r["location"], "price": _keep(r["price"], prev, "price")}

    def freight_row(idx: int, r: dict[str, Any]) -> dict[str, Any]:
        prev = next((p for p in ex_freight if _low(p.get("destination")) == _low(r["destination"])), None)
        return {"id": f"freight_row_{idx + 1}", "destination": r["destination"], "amount": _keep(r["amount"], prev, "amount")}

    converted = {
        "yarn": {
            "id": "yarn",
            "name": "Yarn Ex-Mill Prices",
            "description": "Daily Ex-Mill pricing for knitting, weaving, and double cotton yarns (₹/kg)",
            "columns": [
                {"id": "yarnCount", "name": "Yarn Count", "type": "text", "width": 140},
                {"id": "quality", "name": "Quality", "type": "text", "width": 120},
                {"id": "category", "name": "Category", "type": "text", "width": 160},
                {"id": "exMillPrice", "name": "Ex-Mill Price (₹/kg)", "type": "number", "width": 160},
                {"id": "factoryLocation", "name": "Factory Location", "type": "text", "width": 180},
            ],
            "rows": [yarn_row(i, r) for i, r in enumerate(parsed_yarn["records"])] if parsed_yarn["records"] else ex_yarn,
        },
        "fob": {
            "id": "fob",
            "name": "FOB Direct Rates",
            "description": "Factory and inland terminal direct container transport charges to Mundra/Port (₹/FCL)",
            "columns": [
                {"id": "location", "name": "Port / Mill Location", "type": "text", "width": 220},
                {"id": "price", "name": "FOB Cost (₹/container)", "type": "number", "width": 200},
            ],
            "rows": [fob_row(i, r) for i, r in enumerate(parsed_fob["records"])] if parsed_fob["records"] else ex_fob,
        },
        "freight": {
            "id": "freight",
            "name": "Ocean Freight Rates",
            "description": "Port of Discharge (POD) container rates from Mundra (USD/40' HC)",
            "columns": [
                {"id": "destination", "name": "Destination Port", "type": "text", "width": 220},
                {"id": "amount", "name": "Freight(USD)", "type": "number", "width": 220},
            ],
            "rows": [freight_row(i, r) for i, r in enumerate(parsed_freight["records"])] if parsed_freight["records"] else ex_freight,
        },
    }
    return await run_in_threadpool(pricing_store.save_and_publish_daily_prices, converted, confirmed_by or "Admin")


async def background_merge_if_confirmed(force: bool) -> None:
    """tryFetchAndSyncFromGoogleSheets: only on explicit ?refresh=true and only once today is confirmed,
    so stored prices never change while the day is locked."""
    if not force:
        return
    store = await run_in_threadpool(pricing_store.get_daily_pricing_store)
    if store.get("lastConfirmedDate") != pricing_store.get_today_date_string():
        return

    async def fetch(url: str) -> str | None:
        if not url:
            return None
        try:
            check_sheet_url(url)
            async with httpx.AsyncClient(timeout=httpx.Timeout(9.0), follow_redirects=True) as client:
                res = await client.get(url)
            if res.status_code >= 400:
                return None
            text = res.text
            if "<!DOCTYPE" in text or "<html" in text:
                return None
            return text
        except Exception:
            return None

    try:
        urls = await run_in_threadpool(get_configured_urls)
        t_yarn, t_fob, t_freight = await asyncio.gather(
            fetch(urls["yarnCsvUrl"]),
            fetch(urls["fobCsvUrl"]),
            fetch(urls["freightCsvUrl"]),
        )
        parsed: dict[str, Any] = {}
        if t_yarn:
            parsed["yarnRecords"] = parse_google_sheet_yarn_csv(t_yarn)["records"]
        if t_fob:
            parsed["fobRecords"] = parse_google_sheet_fob_csv(t_fob)["records"]
        if t_freight:
            parsed["freightRecords"] = parse_google_sheet_freight_csv(t_freight)["records"]
        if parsed.get("yarnRecords") or parsed.get("fobRecords") or parsed.get("freightRecords"):
            await run_in_threadpool(pricing_store.merge_live_google_sheet_data, parsed)
    except Exception as e:
        log.warning("Live Google Sheet background sync notice: %s", e)

