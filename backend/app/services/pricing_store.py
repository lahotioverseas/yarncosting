"""Daily Pricing Master store and the 12:00 AM IST price lock.

How the lock works
------------------
Prices are "unlocked" only while ``lastConfirmedDate`` equals today's IST date.
At 00:00 IST the date rolls over, so every status check reports
``isConfirmedForToday = False`` and costing / quotation / deal endpoints refuse
to run. Nothing needs to fire at midnight; the lock is derived from the clock.

An admin unlocks the day in one of two ways:
  1. Keep previous prices  -> confirm_previous_prices_for_today()
  2. Edit in Google Sheet  -> start_sheet_edit() records that editing is in
     progress (so every admin screen shows a "Publish Prices" button, even after
     the browser tab was closed), then publishing pulls the edited sheet and
     calls save_and_publish_daily_prices().

Storage: MongoDB Atlas when reachable, always mirrored to a local JSON file.
Port of frontend/src/lib/dailyPricingServer.ts.
"""
from __future__ import annotations

import copy
import json
import logging
import threading
from pathlib import Path
from typing import Any

from .. import config
from . import costing, db
from .ist_time import today_ist
from .jsutil import iso_now, is_nan, is_nullish, js_number, js_string, js_trim, now_ms, random_base36, truthy
from .seeds import default_pricing_snapshot

log = logging.getLogger(__name__)

COLLECTION_NAME = "daily_pricing"
HISTORY_COLLECTION = "daily_pricing_history"
DOCUMENT_ID = "dailyPricing"

STORE_FILE = Path(config.DATA_DIR) / "daily_pricing_store.json"
HISTORY_FILE = Path(config.DATA_DIR) / "daily_pricing_history.json"


class PricingStoreUnavailableError(Exception):
    def __init__(self, message: str = "Pricing store is temporarily unavailable"):
        super().__init__(message)


class NoPublishedPricesError(Exception):
    pass


_lock = threading.RLock()
_latest_sheets: dict[str, Any] | None = None


def _get_db():
    return db.get_db()


def reset_for_tests() -> None:
    """Drop cached state (tests point DATA_DIR at a temp folder)."""
    global _latest_sheets, STORE_FILE, HISTORY_FILE
    db.reset()
    _latest_sheets = None
    STORE_FILE = Path(config.DATA_DIR) / "daily_pricing_store.json"
    HISTORY_FILE = Path(config.DATA_DIR) / "daily_pricing_history.json"


def get_today_date_string() -> str:
    return today_ist()


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _read_store_from_disk() -> dict[str, Any] | None:
    try:
        if STORE_FILE.exists():
            parsed = json.loads(STORE_FILE.read_text(encoding="utf-8"))
            if parsed and (parsed.get("sheets") or {}).get("yarn"):
                return parsed
    except Exception:
        pass
    return None


def _write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _save_history_snapshot(store: dict[str, Any]) -> None:
    date_key = store.get("lastConfirmedDate") or today_ist()
    entry = {
        "_id": date_key,
        "id": date_key,
        "confirmedDate": date_key,
        "confirmedAt": store.get("lastConfirmedAt") or iso_now(),
        "confirmedBy": store.get("lastConfirmedBy") or "Admin",
        "confirmationType": store.get("confirmationType") or "updated_prices",
        "sheets": store.get("sheets"),
        "summary": f"Pricing Snapshot for {date_key} ({store.get('confirmationType') or 'updated'})",
    }
    try:
        history: list[dict[str, Any]] = []
        if HISTORY_FILE.exists():
            history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        idx = next((i for i, h in enumerate(history) if h.get("confirmedDate") == date_key), -1)
        if idx >= 0:
            history[idx] = entry
        else:
            history.insert(0, entry)
        _write_json_atomic(HISTORY_FILE, history)
    except Exception as e:
        log.warning("Could not write local pricing history: %s", e)

    db = _get_db()
    if db is not None:
        try:
            db[HISTORY_COLLECTION].update_one({"_id": date_key}, {"$set": {k: v for k, v in entry.items() if k != "_id"}}, upsert=True)
        except Exception as e:
            log.warning("Failed to save history snapshot to MongoDB: %s", e)


def _save_store(store: dict[str, Any], archive: bool = True) -> None:
    global _latest_sheets
    _write_json_atomic(STORE_FILE, store)
    if archive:
        _save_history_snapshot(store)
    _latest_sheets = store.get("sheets")
    db = _get_db()
    if db is not None:
        try:
            db[COLLECTION_NAME].update_one({"_id": DOCUMENT_ID}, {"$set": store}, upsert=True)
        except Exception as e:
            log.warning("Failed to write to MongoDB Atlas (saved locally): %s", e)


def _sanitize_freight_columns(doc: dict[str, Any]) -> None:
    freight = (doc.get("sheets") or {}).get("freight")
    if not freight or not isinstance(freight.get("columns"), list):
        return
    cols = []
    for c in freight["columns"]:
        name = js_string(c.get("name") or "").lower()
        if c.get("id") == "remarks" or "transit" in name:
            continue
        if c.get("id") == "amount" or "ocean freight" in name or "40'" in name:
            c = {**c, "id": "amount", "name": "Freight(USD)"}
        cols.append(c)
    freight["columns"] = cols


def get_daily_pricing_store() -> dict[str, Any]:
    global _latest_sheets
    doc = None
    db = _get_db()
    if db is not None:
        try:
            doc = db[COLLECTION_NAME].find_one({"_id": DOCUMENT_ID})
        except Exception as e:
            log.warning("MongoDB read failed, falling back to local storage: %s", e)

    if not doc or not (doc.get("sheets") or {}).get("yarn"):
        doc = _read_store_from_disk()

    if not doc or not (doc.get("sheets") or {}).get("yarn"):
        log.info("Seeding daily pricing store from default snapshot...")
        doc = default_pricing_snapshot()
        doc["lastConfirmedDate"] = doc.get("lastConfirmedDate") or None
        with _lock:
            _save_store(doc)

    _sanitize_freight_columns(doc)
    store = {
        "lastConfirmedDate": doc.get("lastConfirmedDate") or None,
        "lastConfirmedAt": doc.get("lastConfirmedAt") or None,
        "lastConfirmedBy": doc.get("lastConfirmedBy") or None,
        "confirmationType": doc.get("confirmationType") or None,
        "editingDate": doc.get("editingDate") or None,
        "editingStartedAt": doc.get("editingStartedAt") or None,
        "editingBy": doc.get("editingBy") or None,
        "sheets": doc["sheets"],
    }
    _latest_sheets = store["sheets"]
    return store


def status_from_store(store: dict[str, Any]) -> dict[str, Any]:
    today = today_ist()
    confirmed = bool(store.get("lastConfirmedDate") and store["lastConfirmedDate"] == today)
    editing = bool(not confirmed and store.get("editingDate") == today)
    sheets = store.get("sheets") or {}
    return {
        "isConfirmedForToday": confirmed,
        "todayDate": today,
        "lastConfirmedDate": store.get("lastConfirmedDate"),
        "lastConfirmedAt": store.get("lastConfirmedAt"),
        "lastConfirmedBy": store.get("lastConfirmedBy"),
        "confirmationType": store.get("confirmationType"),
        "isEditingInSheet": editing,
        "editingStartedAt": store.get("editingStartedAt") if editing else None,
        "editingBy": store.get("editingBy") if editing else None,
        "totalYarnProducts": len((sheets.get("yarn") or {}).get("rows") or []),
        "totalFobLocations": len((sheets.get("fob") or {}).get("rows") or []),
        "totalFreightDestinations": len((sheets.get("freight") or {}).get("rows") or []),
    }


def get_daily_pricing_status() -> dict[str, Any]:
    return status_from_store(get_daily_pricing_store())


def _clear_editing(store: dict[str, Any]) -> None:
    store["editingDate"] = None
    store["editingStartedAt"] = None
    store["editingBy"] = None


# ---------------------------------------------------------------------------
# Lock / unlock actions
# ---------------------------------------------------------------------------

def confirm_previous_prices_for_today(confirmed_by: str) -> dict[str, Any]:
    """Option 1: keep the previous prices and unlock immediately."""
    with _lock:
        store = get_daily_pricing_store()
        store["lastConfirmedDate"] = today_ist()
        store["lastConfirmedAt"] = iso_now()
        store["lastConfirmedBy"] = confirmed_by or "Admin"
        store["confirmationType"] = "kept_previous"
        _clear_editing(store)
        _save_store(store)
        return status_from_store(store)


def start_sheet_edit(started_by: str) -> dict[str, Any]:
    """Option 2: admin opened the Google Sheet to edit. Prices stay locked until published."""
    with _lock:
        store = get_daily_pricing_store()
        store["editingDate"] = today_ist()
        store["editingStartedAt"] = iso_now()
        store["editingBy"] = started_by or "Admin"
        _save_store(store, archive=False)
        return status_from_store(store)


def save_and_publish_daily_prices(sheets: dict[str, Any], confirmed_by: str) -> dict[str, Any]:
    """Publish new prices (from the in-app editor or a Google Sheet sync) and unlock."""
    with _lock:
        store = get_daily_pricing_store()
        store["sheets"] = sheets
        store["lastConfirmedDate"] = today_ist()
        store["lastConfirmedAt"] = iso_now()
        store["lastConfirmedBy"] = confirmed_by or "Admin"
        store["confirmationType"] = "updated_prices"
        _clear_editing(store)
        _save_store(store)
        return {"status": status_from_store(store), "sheets": store["sheets"]}


# ---------------------------------------------------------------------------
# Live records for the calculator dropdowns
# ---------------------------------------------------------------------------

def _num_or_none(raw: Any) -> float | None:
    if raw is None or raw == "":
        return None
    if is_nan(raw):
        return None
    n = js_number(raw)
    if n <= 0:
        return None
    return int(n) if float(n).is_integer() else n


def _text(v: Any, default: str = "") -> str:
    return js_trim(js_string(v) if truthy(v) else default)


def get_live_pricing_records() -> dict[str, Any]:
    store = get_daily_pricing_store()
    status = status_from_store(store)
    sheets = store["sheets"]

    yarn_records = []
    for idx, r in enumerate((sheets.get("yarn") or {}).get("rows") or []):
        yarn_records.append({
            "yarnCount": _text(r.get("yarnCount")),
            "quality": _text(r.get("quality")),
            "category": _text(r.get("category"), "General"),
            "exMillPrice": _num_or_none(r.get("exMillPrice")),
            "factoryLocation": _text(r.get("factoryLocation"), "Factory Location not available."),
            "rawRow": idx + 1,
        })
    unique_counts: list[str] = []
    for r in yarn_records:
        if r["yarnCount"] and r["yarnCount"] not in unique_counts:
            unique_counts.append(r["yarnCount"])

    fob_records = []
    for idx, r in enumerate((sheets.get("fob") or {}).get("rows") or []):
        fob_records.append({"location": _text(r.get("location")), "price": _num_or_none(r.get("price")), "rawRow": idx + 1})
    fob_locations: list[str] = []
    for r in fob_records:
        if r["location"] and r["location"] not in fob_locations:
            fob_locations.append(r["location"])

    freight_records = []
    for idx, r in enumerate((sheets.get("freight") or {}).get("rows") or []):
        freight_records.append({"destination": _text(r.get("destination")), "amount": _num_or_none(r.get("amount")), "rawRow": idx + 1})
    destinations: list[str] = []
    for r in freight_records:
        if r["destination"] and r["destination"] not in destinations:
            destinations.append(r["destination"])

    return {
        "status": status,
        "yarn": {"records": yarn_records, "uniqueCounts": unique_counts},
        "fob": {"records": fob_records, "locations": fob_locations},
        "freight": {"records": freight_records, "destinations": destinations},
    }


# ---------------------------------------------------------------------------
# Add / update single rows
# ---------------------------------------------------------------------------

YARN_SHEET_TEMPLATE = {
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
    "rows": [],
}

FOB_SHEET_TEMPLATE = {
    "id": "fob",
    "name": "FOB Direct Rates",
    "description": "Factory and inland terminal direct container transport charges to Mundra/Port (₹/container)",
    "columns": [
        {"id": "location", "name": "Port / Mill Location", "type": "text", "width": 260},
        {"id": "price", "name": "FOB Cost (₹/container)", "type": "number", "width": 240},
    ],
    "rows": [],
}

FREIGHT_SHEET_TEMPLATE = {
    "id": "freight",
    "name": "Ocean Freight Rates",
    "description": "Port of Discharge (POD) container rates from Mundra (USD)",
    "columns": [
        {"id": "destination", "name": "Destination Port", "type": "text", "width": 220},
        {"id": "amount", "name": "Freight(USD)", "type": "number", "width": 220},
    ],
    "rows": [],
}


def _row_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{random_base36(4)}"


def _positive(v: float | None) -> bool:
    return v is not None and v > 0


def add_or_update_destination(destination: str, amount: float | None) -> dict[str, Any]:
    with _lock:
        store = get_daily_pricing_store()
        clean = js_trim(destination)
        if not clean:
            return get_live_pricing_records()
        if not store["sheets"].get("freight"):
            store["sheets"]["freight"] = copy.deepcopy(FREIGHT_SHEET_TEMPLATE)
        rows = store["sheets"]["freight"]["rows"]
        existing = next((r for r in rows if _text(r.get("destination")).lower() == clean.lower()), None)
        if existing is not None:
            if amount is not None:
                existing["amount"] = amount
        else:
            rows.append({"id": _row_id("freight_row"), "destination": clean, "amount": amount if _positive(amount) else None})
        _save_store(store)
    return get_live_pricing_records()


def add_or_update_fob_location(location: str, price: float | None) -> dict[str, Any]:
    with _lock:
        store = get_daily_pricing_store()
        clean = js_trim(location)
        if not clean:
            return get_live_pricing_records()
        if not store["sheets"].get("fob"):
            store["sheets"]["fob"] = copy.deepcopy(FOB_SHEET_TEMPLATE)
        rows = store["sheets"]["fob"]["rows"]
        existing = next((r for r in rows if _text(r.get("location")).lower() == clean.lower()), None)
        if existing is not None:
            if price is not None:
                existing["price"] = price
        else:
            rows.append({"id": _row_id("fob_row"), "location": clean, "price": price if _positive(price) else None})
        _save_store(store)
    return get_live_pricing_records()


def add_or_update_yarn_product(
    yarn_count: str,
    quality: str,
    ex_mill_price: float | None,
    factory_location: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    with _lock:
        store = get_daily_pricing_store()
        count, qual = js_trim(yarn_count), js_trim(quality)
        if not count or not qual:
            return get_live_pricing_records()
        if not store["sheets"].get("yarn"):
            store["sheets"]["yarn"] = copy.deepcopy(YARN_SHEET_TEMPLATE)
        rows = store["sheets"]["yarn"]["rows"]
        existing = next(
            (r for r in rows if _text(r.get("yarnCount")).lower() == count.lower() and _text(r.get("quality")).lower() == qual.lower()),
            None,
        )
        if existing is not None:
            if ex_mill_price is not None:
                existing["exMillPrice"] = ex_mill_price
            if factory_location:
                existing["factoryLocation"] = factory_location
            if category:
                existing["category"] = category
        else:
            rows.append({
                "id": _row_id("yarn_row"),
                "yarnCount": count,
                "quality": qual,
                "category": category or "General",
                "exMillPrice": ex_mill_price if _positive(ex_mill_price) else None,
                "factoryLocation": factory_location or "Factory Location not available.",
            })
        _save_store(store)
    return get_live_pricing_records()


def merge_live_google_sheet_data(parsed: dict[str, Any]) -> dict[str, Any]:
    """Merge freshly parsed sheet records into the store (rows missing from the sheet are dropped)."""
    with _lock:
        store = get_daily_pricing_store()
        changed = False

        def merge(sheet_key, template, recs, key_fn, rec_key_fn, update_fn, new_row_fn):
            nonlocal changed
            if not recs:
                return
            if not store["sheets"].get(sheet_key):
                store["sheets"][sheet_key] = copy.deepcopy(template)
            current = store["sheets"][sheet_key].get("rows") or []
            wanted = {rec_key_fn(r) for r in recs}
            remaining = [r for r in current if key_fn(r) in wanted]
            if len(remaining) != len(current):
                changed = True
            updated = []
            for rec in recs:
                existing = next((r for r in remaining if key_fn(r) == rec_key_fn(rec)), None)
                if existing is not None:
                    if update_fn(existing, rec):
                        changed = True
                    updated.append(existing)
                else:
                    updated.append(new_row_fn(rec))
                    changed = True
            store["sheets"][sheet_key]["rows"] = updated

        def upd_amount(field):
            def _u(existing, rec):
                v = rec.get(field)
                if not is_nullish(v) and v > 0 and existing.get(field) != v:
                    existing[field] = v
                    return True
                return False
            return _u

        merge(
            "freight", FREIGHT_SHEET_TEMPLATE, parsed.get("freightRecords"),
            lambda r: _text(r.get("destination")).lower(),
            lambda r: js_trim(r["destination"]).lower(),
            upd_amount("amount"),
            lambda rec: {"id": _row_id("freight_row_gs"), "destination": js_trim(rec["destination"]),
                         "amount": rec["amount"] if _positive(rec.get("amount")) else None},
        )
        merge(
            "fob", FOB_SHEET_TEMPLATE, parsed.get("fobRecords"),
            lambda r: _text(r.get("location")).lower(),
            lambda r: js_trim(r["location"]).lower(),
            upd_amount("price"),
            lambda rec: {"id": _row_id("fob_row_gs"), "location": js_trim(rec["location"]),
                         "price": rec["price"] if _positive(rec.get("price")) else None},
        )

        def upd_yarn(existing, rec):
            dirty = False
            if rec.get("factoryLocation") and (
                not existing.get("factoryLocation") or existing.get("factoryLocation") == "Factory Location not available."
            ):
                existing["factoryLocation"] = rec["factoryLocation"]
                dirty = True
            return upd_amount("exMillPrice")(existing, rec) or dirty

        merge(
            "yarn", YARN_SHEET_TEMPLATE, parsed.get("yarnRecords"),
            lambda r: f"{_text(r.get('yarnCount')).lower()}__{_text(r.get('quality')).lower()}",
            lambda r: f"{js_trim(r['yarnCount']).lower()}__{js_trim(r['quality']).lower()}",
            upd_yarn,
            lambda rec: {"id": _row_id("yarn_row_gs"), "yarnCount": js_trim(rec["yarnCount"]), "quality": js_trim(rec["quality"]),
                         "category": rec.get("category") or "General",
                         "exMillPrice": rec["exMillPrice"] if _positive(rec.get("exMillPrice")) else None,
                         "factoryLocation": rec.get("factoryLocation") or "Gujrat"},
        )

        if changed:
            _save_store(store)
    return get_live_pricing_records()


# ---------------------------------------------------------------------------
# History (admin recovery)
# ---------------------------------------------------------------------------

def _clean_doc(d: dict[str, Any]) -> dict[str, Any]:
    out = {k: (str(v) if k == "_id" else v) for k, v in d.items()}
    out["id"] = out.get("_id") or out.get("confirmedDate")
    return out


def get_daily_pricing_history() -> list[dict[str, Any]]:
    db = _get_db()
    if db is not None:
        try:
            docs = list(db[HISTORY_COLLECTION].find({}).sort("confirmedDate", -1))
            if docs:
                return [_clean_doc(d) for d in docs]
        except Exception:
            pass
    try:
        if HISTORY_FILE.exists():
            local = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            if local:
                return local
    except Exception:
        pass
    store = get_daily_pricing_store()
    key = store.get("lastConfirmedDate") or today_ist()
    return [{
        "id": key,
        "confirmedDate": key,
        "confirmedAt": store.get("lastConfirmedAt") or iso_now(),
        "confirmedBy": store.get("lastConfirmedBy") or "Admin",
        "confirmationType": store.get("confirmationType") or "updated_prices",
        "sheets": store["sheets"],
        "summary": "Current Active Pricing Snapshot",
    }]


def get_daily_pricing_history_entry(entry_id: str) -> dict[str, Any]:
    db = _get_db()
    if db is not None:
        try:
            doc = db[HISTORY_COLLECTION].find_one({"$or": [{"_id": entry_id}, {"confirmedDate": entry_id}]})
            if doc:
                return _clean_doc(doc)
        except Exception:
            pass
    try:
        if HISTORY_FILE.exists():
            local = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            found = next((h for h in local if h.get("id") == entry_id or h.get("confirmedDate") == entry_id), None)
            if found:
                return found
    except Exception:
        pass
    store = get_daily_pricing_store()
    return {
        "id": entry_id,
        "sheets": store["sheets"],
        "confirmedDate": store.get("lastConfirmedDate"),
        "confirmedBy": store.get("lastConfirmedBy"),
        "confirmationType": store.get("confirmationType"),
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def initialize_mongo_collections_and_seed() -> None:
    """Make sure the Mongo pricing document and history collection exist (runs in background at boot)."""
    db = _get_db()
    if db is None:
        log.info("MongoDB not configured/reachable - using local file storage at %s", STORE_FILE)
        return
    try:
        col = db[COLLECTION_NAME]
        existing = col.find_one({"_id": DOCUMENT_ID})
        if not existing or not existing.get("sheets"):
            seed = _read_store_from_disk() or default_pricing_snapshot()
            col.update_one({"_id": DOCUMENT_ID}, {"$set": seed}, upsert=True)
            existing = seed
            log.info("Seeded default 'dailyPricing' document in MongoDB.")
        hist = db[HISTORY_COLLECTION]
        if hist.count_documents({}) == 0:
            key = today_ist()
            hist.update_one({"_id": key}, {"$set": {
                "id": key,
                "confirmedDate": key,
                "confirmedAt": existing.get("lastConfirmedAt") or iso_now(),
                "confirmedBy": existing.get("lastConfirmedBy") or "Admin",
                "confirmationType": existing.get("confirmationType") or "updated_prices",
                "sheets": existing.get("sheets"),
                "summary": f"Initial Seed Pricing Snapshot for {key}",
            }}, upsert=True)
    except Exception as e:
        log.warning("Failed to initialize MongoDB collections on startup: %s", e)


def _dynamic_freight_rows() -> list[dict[str, Any]]:
    sheets = _latest_sheets
    if sheets is None:
        disk = _read_store_from_disk()
        sheets = (disk or default_pricing_snapshot()).get("sheets") or {}
    return (sheets.get("freight") or {}).get("rows") or []


costing.dynamic_freight_rows_provider = _dynamic_freight_rows
