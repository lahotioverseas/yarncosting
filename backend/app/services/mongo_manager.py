"""MongoDB Atlas connection checks, collection ("table") setup and full data push.
Port of frontend/src/lib/mongoDbManager.ts."""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
import certifi
from pymongo import MongoClient, UpdateOne

from ..config import DATA_DIR
from .jsutil import format_en_in, iso_now, now_ms, utc_date_str
from .seeds import default_pricing_snapshot, drip_seed, system_users, zoho_fallback_accounts

log = logging.getLogger(__name__)

def _initial_uri() -> str:
    """MONGODB_URI from the environment (.env locally, Project Settings -> Environment Variables on Vercel)."""
    return (os.environ.get("MONGODB_URI") or "").strip()


ACTIVE_MONGODB_URI: str = _initial_uri()
DB_NAME: str = os.environ.get("MONGODB_DB_NAME") or "lahoti_costing_db"


def _tls(uri: str) -> dict:
    return {"tlsCAFile": certifi.where()} if uri.startswith("mongodb+srv://") or "tls=true" in uri.lower() else {}


def get_active_uri() -> str:
    return ACTIVE_MONGODB_URI


def set_active_mongo_uri(uri: str) -> str:
    global ACTIVE_MONGODB_URI
    clean = uri.strip()
    if clean and "?" not in clean and clean.endswith("/"):
        clean = f"{clean}lahoti_costing_db?retryWrites=true&w=majority"
    ACTIVE_MONGODB_URI = clean
    return ACTIVE_MONGODB_URI


def _read_local_json(name: str) -> Any:
    try:
        p = Path(DATA_DIR) / name
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


PRODUCTS_SEED = [
    {
        "id": "p_cotton_01",
        "code": "COTTON_YARN",
        "name": "Cotton Yarn",
        "description": "100% Cotton Yarn for Export Weaving & Hosiery",
        "active": True,
    },
]

YARN_COUNTS_SEED = [
    {"id": "yc_20c", "product_code": "COTTON_YARN", "count_name": "20s Carded", "yarn_type": "Carded", "purpose": "Weaving", "standard_bag_weight_kg": 60.0, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
    {"id": "yc_30ch", "product_code": "COTTON_YARN", "count_name": "30s Combed Hosiery", "yarn_type": "Combed", "purpose": "Hosiery", "standard_bag_weight_kg": 60.0, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
    {"id": "yc_40cw", "product_code": "COTTON_YARN", "count_name": "40s Compact Weaving", "yarn_type": "Compact", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
    {"id": "yc_50c", "product_code": "COTTON_YARN", "count_name": "50s Combed", "yarn_type": "Combed", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
    {"id": "yc_60c", "product_code": "COTTON_YARN", "count_name": "60s Combed", "yarn_type": "Combed", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
    {"id": "yc_80c", "product_code": "COTTON_YARN", "count_name": "80s Compact", "yarn_type": "Compact", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.7, "drawback_rate_pct": 1.5},
]

FOB_RATES_SEED = [
    {"id": "fob_mundra", "product_code": "COTTON_YARN", "location": "Mundra", "variant_label": "Port", "display_label": "Mundra (₹62,000)", "amount": 62000, "currency": "INR"},
    {"id": "fob_nhava", "product_code": "COTTON_YARN", "location": "Nhava Sheva (JNPT)", "variant_label": "Port", "display_label": "Nhava Sheva (₹70,000)", "amount": 70000, "currency": "INR"},
    {"id": "fob_tuticorin", "product_code": "COTTON_YARN", "location": "Tuticorin", "variant_label": "Port", "display_label": "Tuticorin (₹55,000)", "amount": 55000, "currency": "INR"},
    {"id": "fob_chennai", "product_code": "COTTON_YARN", "location": "Chennai", "variant_label": "Port", "display_label": "Chennai (₹58,000)", "amount": 58000, "currency": "INR"},
    {"id": "fob_north", "product_code": "COTTON_YARN", "location": "North", "variant_label": "Region", "display_label": "North (₹1,00,000)", "amount": 100000, "currency": "INR"},
    {"id": "fob_mah", "product_code": "COTTON_YARN", "location": "Maharastra", "variant_label": "State", "display_label": "Maharastra (₹85,000)", "amount": 85000, "currency": "INR"},
    {"id": "fob_andhra", "product_code": "COTTON_YARN", "location": "Andhra", "variant_label": "State", "display_label": "Andhra (₹85,000)", "amount": 85000, "currency": "INR"},
    {"id": "fob_tn", "product_code": "COTTON_YARN", "location": "TN", "variant_label": "State", "display_label": "TN (₹70,000)", "amount": 70000, "currency": "INR"},
    {"id": "fob_nagpur", "product_code": "COTTON_YARN", "location": "Nagpur", "variant_label": "Location", "display_label": "Nagpur (₹1,23,000)", "amount": 123000, "currency": "INR"},
    {"id": "fob_pusad", "product_code": "COTTON_YARN", "location": "Pusad", "variant_label": "Location", "display_label": "Pusad (₹1,20,000)", "amount": 120000, "currency": "INR"},
    {"id": "fob_birat15", "product_code": "COTTON_YARN", "location": "Biratnagar", "variant_label": "15 tons", "display_label": "Biratnagar 15 tons (₹1,69,000)", "amount": 169000, "currency": "INR"},
    {"id": "fob_katmandu", "product_code": "COTTON_YARN", "location": "Katmandu", "variant_label": "Location", "display_label": "Katmandu (₹2,20,000)", "amount": 220000, "currency": "INR"},
    {"id": "fob_birat23a", "product_code": "COTTON_YARN", "location": "Biratnagar", "variant_label": "23 tons Route A", "display_label": "Biratnagar 23 tons (₹2,40,000)", "amount": 240000, "currency": "INR"},
    {"id": "fob_keytex", "product_code": "COTTON_YARN", "location": "keytex", "variant_label": "Location", "display_label": "keytex (₹1,20,000)", "amount": 120000, "currency": "INR"},
]

FREIGHT_RATES_SEED = [
    {"id": "fr_catlai", "origin": "Gujarat", "destination": "Cat Lai", "amount": 300},
    {"id": "fr_callao", "origin": "Gujarat", "destination": "Callao", "amount": 2900},
    {"id": "fr_eldekhila", "origin": "Gujarat", "destination": "El Dekhila / Alex", "amount": 2750},
    {"id": "fr_istanbul", "origin": "Gujarat", "destination": "Istanbul", "amount": 2875},
    {"id": "fr_lexious", "origin": "Gujarat", "destination": "Lexious", "amount": 3075},
    {"id": "fr_hamburg", "origin": "Gujarat", "destination": "Hamburg", "amount": 2675},
    {"id": "fr_chittagong", "origin": "Gujarat", "destination": "Chittagong", "amount": 950},
    {"id": "fr_qingdao", "origin": "Gujarat", "destination": "Qingdao / SH", "amount": 200},
    {"id": "fr_pasirgudang", "origin": "Gujarat", "destination": "Pasir Gudang", "amount": 300},
    {"id": "fr_buenaventura", "origin": "Gujarat", "destination": "Buenaventura", "amount": 2750},
    {"id": "fr_portlouis", "origin": "Gujarat", "destination": "Port Louis", "amount": 2100},
    {"id": "fr_gdynia", "origin": "Gujarat", "destination": "Gdynia", "amount": 2050},
    {"id": "fr_colombo", "origin": "Gujarat", "destination": "Colombo", "amount": 600},
    {"id": "fr_wuhu", "origin": "Gujarat", "destination": "Wuhu", "amount": 300},
    {"id": "fr_alsohkna", "origin": "Gujarat", "destination": "Al Sokhna", "amount": 3600},
    {"id": "fr_casablanca", "origin": "Gujarat", "destination": "Casablanca", "amount": 2950},
    {"id": "fr_lazarocardenas", "origin": "Gujarat", "destination": "Lazaro Cardenas", "amount": 3200},
    {"id": "fr_tunis", "origin": "Gujarat", "destination": "Tunis", "amount": 2950},
    {"id": "fr_mah_casablanca", "origin": "Maharashtra", "destination": "Casablanca", "amount": 2900},
    {"id": "fr_chennai_puerto", "origin": "Chennai", "destination": "Puerto Quetzal", "amount": 4065},
]
for _fr in FREIGHT_RATES_SEED:
    _fr.update({"product_code": "COTTON_YARN", "currency": "USD", "unit": "PER_FCL"})

CONTAINER_CONFIGS_SEED = [
    {"id": "cc_20ft", "product_code": "COTTON_YARN", "container_type": "20FT_FCL", "display_name": "20ft Standard FCL Container", "max_capacity_kg": 18000.0, "bags_count": 300},
    {"id": "cc_40hc", "product_code": "COTTON_YARN", "container_type": "40FT_HC", "display_name": "40ft High Cube Container", "max_capacity_kg": 24500.0, "bags_count": 540},
]

MARGIN_TERMS_SEED = [
    {"id": "mt_lc_sight", "product_code": "COTTON_YARN", "term_code": "LC_AT_SIGHT_20_80", "term_label": "LC at site / 20-80", "margin_pct": 3.0, "is_default": True},
    {"id": "mt_lc_90", "product_code": "COTTON_YARN", "term_code": "LC_90", "term_label": "LC 90 days", "margin_pct": 3.5, "is_default": False},
    {"id": "mt_lc_120", "product_code": "COTTON_YARN", "term_code": "LC_120", "term_label": "LC 120 days", "margin_pct": 4.0, "is_default": False},
]

QUANTITY_MASTER_SEED = [
    {"id": "qm_cartons", "product_code": "COTTON_YARN", "packing_type": "Cartons", "qty_per_fcl": 21319.2, "is_default": True},
    {"id": "qm_pallets", "product_code": "COTTON_YARN", "packing_type": "Pallets", "qty_per_fcl": 19500.0, "is_default": False},
    {"id": "qm_double_yarn", "product_code": "COTTON_YARN", "packing_type": "Double yarn carton", "qty_per_fcl": 20412.0, "is_default": False},
    {"id": "qm_oe_pallet", "product_code": "COTTON_YARN", "packing_type": "OE yarn Pallet", "qty_per_fcl": 19000.0, "is_default": False},
    {"id": "qm_oe_carton", "product_code": "COTTON_YARN", "packing_type": "OE yarn carton", "qty_per_fcl": 19000.0, "is_default": False},
]


def _exchange_rates_seed() -> list[dict[str, Any]]:
    today, now = utc_date_str(), iso_now()
    return [
        {"currency_pair": "USD_INR", "base_currency": "USD", "quote_currency": "INR", "rate": 95.43, "fx_buffer_margin": 0.0, "effective_rate": 95.43, "rate_date": today, "last_updated_at": now},
        {"currency_pair": "EUR_INR", "base_currency": "EUR", "quote_currency": "INR", "rate": 111.36, "fx_buffer_margin": 0.0, "effective_rate": 111.36, "rate_date": today, "last_updated_at": now},
    ]


def _pricing_store_on_disk() -> Any:
    return _read_local_json("daily_pricing_store.json")


def _seed_daily_pricing() -> list[dict[str, Any]]:
    store = _pricing_store_on_disk() or default_pricing_snapshot()
    today, now = utc_date_str(), iso_now()
    sheets = store.get("sheets") or {}
    return [{
        "_id": "dailyPricing",
        "id": "dailyPricing",
        "status": {
            "isConfirmedForToday": True,
            "todayDate": today,
            "lastConfirmedDate": store.get("lastConfirmedDate") or today,
            "lastConfirmedAt": store.get("lastConfirmedAt") or now,
            "lastConfirmedBy": store.get("lastConfirmedBy") or "Admin",
            "confirmationType": store.get("confirmationType") or "initial_setup",
            "totalYarnProducts": len((sheets.get("yarn") or {}).get("rows") or []),
            "totalFobLocations": len((sheets.get("fob") or {}).get("rows") or []),
            "totalFreightDestinations": len((sheets.get("freight") or {}).get("rows") or []),
        },
        "sheets": sheets,
        "createdAt": now,
        "updatedAt": now,
    }]


def _seed_history() -> list[dict[str, Any]]:
    store = _pricing_store_on_disk() or default_pricing_snapshot()
    today = utc_date_str()
    return [{
        "_id": today,
        "id": today,
        "confirmedDate": today,
        "confirmedAt": iso_now(),
        "confirmedBy": "Admin",
        "confirmationType": "initial_setup",
        "sheets": store.get("sheets"),
        "summary": f"Initial Seed Snapshot for {today}",
    }]


def _drip_store() -> dict[str, Any]:
    return _read_local_json("leads_drip_store.json") or {}


def _seed_users() -> list[dict[str, Any]]:
    now = iso_now()
    return [
        {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"], "title": u["title"], "active": True, "createdAt": now}
        for u in system_users()
    ]


DASHBOARD_TABLE_DEFINITIONS: list[dict[str, Any]] = [
    {"name": "products", "description": "Master Products and Commodities for Export Trading",
     "indexes": [({"code": 1}, {"unique": True}), ({"active": 1}, {})],
     "seed": lambda: [{**p, "created_at": iso_now()} for p in PRODUCTS_SEED]},
    {"name": "yarn_counts", "description": "Cotton Yarn Counts Specifications, Rebates & Bag Weights",
     "indexes": [({"count_name": 1}, {"unique": True}), ({"product_code": 1}, {}), ({"yarn_type": 1}, {})],
     "seed": lambda: [dict(y) for y in YARN_COUNTS_SEED]},
    {"name": "fob_rates", "description": "Port & Inland Clearance FOB Logistics Rates (INR / Container)",
     "indexes": [({"location": 1, "variant_label": 1}, {}), ({"display_label": 1}, {})],
     "seed": lambda: [dict(f) for f in FOB_RATES_SEED]},
    {"name": "freight_rates", "description": "Ocean Freight Rates Matrix by Origin and Destination Port",
     "indexes": [({"origin": 1, "destination": 1}, {"unique": True}), ({"destination": 1}, {})],
     "seed": lambda: [dict(f) for f in FREIGHT_RATES_SEED]},
    {"name": "container_configs", "description": "Container Capacity Configurations (20FT FCL, 40FT HC)",
     "indexes": [({"container_type": 1}, {"unique": True})],
     "seed": lambda: [dict(c) for c in CONTAINER_CONFIGS_SEED]},
    {"name": "margin_terms", "description": "Payment Terms and Trader Margin Percentages",
     "indexes": [({"term_code": 1}, {"unique": True})],
     "seed": lambda: [dict(m) for m in MARGIN_TERMS_SEED]},
    {"name": "quantity_master", "description": "Standard Packaging Types and Quantities per Container",
     "indexes": [({"packing_type": 1}, {"unique": True})],
     "seed": lambda: [dict(q) for q in QUANTITY_MASTER_SEED]},
    {"name": "exchange_rates", "description": "Real-time and Historical FX Exchange Rates (USD/INR, EUR/INR)",
     "indexes": [({"currency_pair": 1, "rate_date": -1}, {}), ({"rate_date": -1}, {})],
     "seed": _exchange_rates_seed},
    {"name": "costing_records", "description": "Saved Quotation Calculations, Historical Inputs, Outputs & Deals",
     "indexes": [({"reference_no": 1}, {"unique": True}), ({"created_at": -1}, {}), ({"customer_name": 1}, {}), ({"zoho_deal_id": 1}, {})],
     "seed": lambda: []},
    {"name": "daily_pricing", "description": "Active Daily Pricing Snapshot (Yarn, FOB & Freight Sheets)",
     "indexes": [({"_id": 1}, {}), ({"lastConfirmedDate": -1}, {})],
     "seed": _seed_daily_pricing},
    {"name": "daily_pricing_history", "description": "Historical Daily Midnight Price Revision Snapshots and Audit Log",
     "indexes": [({"confirmedDate": -1}, {}), ({"confirmedAt": -1}, {})],
     "seed": _seed_history},
    {"name": "leads", "description": "CRM Leads & Cotton Yarn Export Inquiries",
     "indexes": [({"email": 1}, {}), ({"status": 1}, {}), ({"country": 1}, {}), ({"createdAt": -1}, {})],
     "seed": lambda: _drip_store().get("leads") or drip_seed()["leads"]},
    {"name": "campaign_templates", "description": "Automated Drip Email & Touchpoint Follow-up Templates",
     "indexes": [({"id": 1}, {"unique": True})],
     "seed": lambda: _drip_store().get("templates") or drip_seed()["templates"]},
    {"name": "lead_campaign_workflows", "description": "Active Lead Drip Campaign Automations and Touchpoint Logs",
     "indexes": [({"leadId": 1}, {}), ({"status": 1}, {}), ({"nextActionDate": 1}, {})],
     "seed": lambda: []},
    {"name": "zoho_accounts", "description": "Zoho CRM Customer Accounts, Importers & Contact Profiles",
     "indexes": [({"id": 1}, {"unique": True}), ({"name": 1}, {}), ({"owner_name": 1}, {})],
     "seed": lambda: (_read_local_json("zoho_accounts_cache.json") or {}).get("items") or zoho_fallback_accounts()},
    {"name": "users", "description": "Authorized Team Members, Roles & Access Credentials",
     "indexes": [({"email": 1}, {"unique": True}), ({"role": 1}, {})],
     "seed": _seed_users},
    {"name": "audit_logs", "description": "System Activity Trail (Price Confirmations, Zoho Exports, Auth)",
     "indexes": [({"timestamp": -1}, {}), ({"action": 1}, {}), ({"user_id": 1}, {})],
     "seed": lambda: [{
         "id": "log_init_001", "action": "SYSTEM_INITIALIZATION", "user_name": "System", "user_id": "sys",
         "details": "Initialized MongoDB schema and verified collections", "timestamp": iso_now(),
     }]},
]

_cached_outbound_ip: str | None = None


def get_outbound_ip() -> str:
    global _cached_outbound_ip
    if _cached_outbound_ip:
        return _cached_outbound_ip
    try:
        res = httpx.get("https://api.ipify.org?format=json", timeout=3.0)
        if res.status_code < 400:
            ip = (res.json() or {}).get("ip")
            if ip:
                _cached_outbound_ip = ip
                return ip
    except Exception:
        pass
    return "34.34.244.61"


def mask_mongo_uri(uri: str) -> str:
    try:
        return re.sub(r"://[^:]+:[^@]+@", "://***:***@", uri, count=1)
    except Exception:
        return "mongodb+srv://***:***@cluster..."


def check_mongo_connection(override_uri: str | None = None) -> dict[str, Any]:
    outbound_ip = get_outbound_ip()
    uri = override_uri or ACTIVE_MONGODB_URI
    masked = mask_mongo_uri(uri)

    if not uri or "<username>" in uri or "<password>" in uri:
        return {
            "connected": False, "dbName": DB_NAME, "maskedUri": masked, "outboundIp": outbound_ip,
            "serverSelectionTimeout": False, "ipWhitelistError": False, "authError": False,
            "errorMessage": "MONGODB_URI is not configured with real credentials.",
            "instruction": "Set MONGODB_URI in your environment secrets with valid credentials.",
        }

    start = now_ms()
    client = None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, socketTimeoutMS=3000, waitQueueTimeoutMS=3000, **_tls(uri))
        db = client[DB_NAME]
        db.command("ping")
        databases = [DB_NAME]
        try:
            databases = client.list_database_names()
        except Exception:
            pass  # user scoped to DB_NAME, expected
        try:
            cluster_host = urlsplit(uri).hostname or ""
        except Exception:
            cluster_host = ""
        return {
            "connected": True, "dbName": DB_NAME, "maskedUri": masked, "clusterHost": cluster_host,
            "outboundIp": outbound_ip, "serverSelectionTimeout": False, "ipWhitelistError": False,
            "authError": False, "errorMessage": None, "databases": databases, "latencyMs": now_ms() - start,
        }
    except Exception as err:
        msg = str(err)
        is_tls80 = "SSL alert number 80" in msg or "tlsv1 alert internal error" in msg
        is_timeout = "Server selection timed out" in msg or "ETIMEDOUT" in msg or "timed out" in msg.lower()
        is_auth = "bad auth" in msg or "Authentication failed" in msg
        if is_tls80 or is_timeout:
            instruction = (
                'MongoDB Atlas rejected the connection. In MongoDB Atlas, go to "Network Access" -> click "Add IP Address" '
                f'-> choose "Allow Access from Anywhere" (0.0.0.0/0) or add outbound IP {outbound_ip}.'
            )
        elif is_auth:
            instruction = "MongoDB database username or password in MONGODB_URI is incorrect. Verify Database Access credentials in MongoDB Atlas."
        else:
            instruction = f"Connection attempt failed: {msg}. Check network connectivity and cluster state."
        return {
            "connected": False, "dbName": DB_NAME, "maskedUri": masked, "outboundIp": outbound_ip,
            "serverSelectionTimeout": is_timeout, "ipWhitelistError": is_tls80, "authError": is_auth,
            "errorMessage": msg, "instruction": instruction,
        }
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def create_all_mongo_tables(override_uri: str | None = None) -> dict[str, Any]:
    uri = override_uri or ACTIVE_MONGODB_URI
    conn = check_mongo_connection(uri)
    timestamp = iso_now()

    if not conn["connected"]:
        return {
            "success": False, "dbName": DB_NAME, "totalTables": len(DASHBOARD_TABLE_DEFINITIONS),
            "createdOrVerifiedCount": 0, "connection": conn,
            "tables": [
                {"name": d["name"], "description": d["description"], "exists": False, "documentCount": 0,
                 "indexesCount": 0, "status": "pending", "error": conn.get("errorMessage") or "Connection unavailable"}
                for d in DASHBOARD_TABLE_DEFINITIONS
            ],
            "timestamp": timestamp,
        }

    client = MongoClient(uri, serverSelectionTimeoutMS=8000, **_tls(uri))
    reports: list[dict[str, Any]] = []
    try:
        db = client[DB_NAME]
        existing = set(db.list_collection_names())
        for d in DASHBOARD_TABLE_DEFINITIONS:
            name = d["name"]
            status = "verified"
            try:
                if name not in existing:
                    db.create_collection(name)
                    existing.add(name)
                    status = "created"
                col = db[name]
                for keys, opts in d["indexes"]:
                    if list(keys.keys()) == ["_id"]:
                        continue  # _id index always exists
                    try:
                        col.create_index(list(keys.items()), **opts)
                    except Exception as idx_err:
                        log.warning("Index notice on %s: %s", name, idx_err)
                if col.count_documents({}) == 0:
                    seed = d["seed"]()
                    if seed:
                        col.insert_many(seed)
                        status = "seeded"
                reports.append({
                    "name": name, "description": d["description"], "exists": True,
                    "documentCount": col.count_documents({}), "indexesCount": len(list(col.list_indexes())),
                    "status": status,
                })
            except Exception as col_err:
                reports.append({
                    "name": name, "description": d["description"], "exists": name in existing,
                    "documentCount": 0, "indexesCount": 0, "status": "failed", "error": str(col_err),
                })
        return {
            "success": True, "dbName": DB_NAME, "totalTables": len(DASHBOARD_TABLE_DEFINITIONS),
            "createdOrVerifiedCount": len([r for r in reports if r["exists"]]), "connection": conn,
            "tables": reports, "timestamp": timestamp,
        }
    finally:
        client.close()


def push_all_application_data(browser_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    browser_payload = browser_payload or {}
    uri = ACTIVE_MONGODB_URI
    conn = check_mongo_connection(uri)
    timestamp = iso_now()
    if not conn["connected"]:
        return {
            "success": False, "dbName": DB_NAME, "itemsPushed": {}, "connection": conn,
            "message": conn.get("instruction") or conn.get("errorMessage") or "MongoDB connection failed",
            "timestamp": timestamp,
        }

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, **_tls(uri))
    pushed: dict[str, int] = {}
    try:
        db = client[DB_NAME]
        existing = set(db.list_collection_names())
        for d in DASHBOARD_TABLE_DEFINITIONS:
            if d["name"] not in existing:
                try:
                    db.create_collection(d["name"])
                except Exception:
                    pass

        # A. Daily pricing
        bp_pricing = browser_payload.get("dailyPricing") or {}
        pricing = bp_pricing if ((bp_pricing.get("sheets") or {}).get("yarn")) else (_pricing_store_on_disk() or default_pricing_snapshot())
        sheets = pricing.get("sheets") or {}
        rows = lambda key: (sheets.get(key) or {}).get("rows") or []  # noqa: E731
        today = utc_date_str()
        db["daily_pricing"].update_one(
            {"_id": "dailyPricing"},
            {"$set": {
                "id": "dailyPricing",
                "status": pricing.get("status") or {
                    "isConfirmedForToday": True, "todayDate": today, "lastConfirmedDate": today,
                    "lastConfirmedAt": iso_now(), "lastConfirmedBy": "Admin", "confirmationType": "browser_migration",
                    "totalYarnProducts": len(rows("yarn")), "totalFobLocations": len(rows("fob")),
                    "totalFreightDestinations": len(rows("freight")),
                },
                "sheets": sheets,
                "updatedAt": timestamp,
            }},
            upsert=True,
        )
        pushed["daily_pricing"] = 1

        # B. History
        today_key = pricing.get("lastConfirmedDate") or today
        db["daily_pricing_history"].update_one(
            {"_id": today_key},
            {"$set": {
                "id": today_key, "confirmedDate": today_key, "confirmedAt": timestamp,
                "confirmedBy": pricing.get("lastConfirmedBy") or "Admin", "confirmationType": "browser_data_push",
                "sheets": sheets, "summary": f"Migrated pricing snapshot for {today_key}",
            }},
            upsert=True,
        )
        pushed["daily_pricing_history"] = 1

        # C. Products, counts, FOB, freight
        db["products"].bulk_write([UpdateOne({"code": p["code"]}, {"$set": p}, upsert=True) for p in PRODUCTS_SEED], ordered=False)
        pushed["products"] = len(PRODUCTS_SEED)

        yarn_ops = [UpdateOne({"count_name": y["count_name"]}, {"$set": y}, upsert=True) for y in YARN_COUNTS_SEED]
        for yr in rows("yarn"):
            if yr.get("yarnCount"):
                yarn_ops.append(UpdateOne({"count_name": yr["yarnCount"]}, {"$set": {
                    "product_code": "COTTON_YARN", "count_name": yr["yarnCount"],
                    "quality": yr.get("quality") or "Standard", "category": yr.get("category") or "General",
                    "ex_mill_price": yr.get("exMillPrice") or None, "factory_location": yr.get("factoryLocation") or "",
                }}, upsert=True))
        if yarn_ops:
            db["yarn_counts"].bulk_write(yarn_ops, ordered=False)
        pushed["yarn_counts"] = len(yarn_ops)

        fob_ops = [UpdateOne({"location": f["location"], "variant_label": f["variant_label"]}, {"$set": f}, upsert=True) for f in FOB_RATES_SEED]
        for fr in rows("fob"):
            if fr.get("location"):
                price = fr.get("price") or 0
                fob_ops.append(UpdateOne({"location": fr["location"]}, {"$set": {
                    "product_code": "COTTON_YARN", "location": fr["location"],
                    "display_label": f"{fr['location']} (₹{format_en_in(float(price))})",
                    "amount": price, "currency": "INR",
                }}, upsert=True))
        if fob_ops:
            db["fob_rates"].bulk_write(fob_ops, ordered=False)
        pushed["fob_rates"] = len(fob_ops)

        freight_ops = [UpdateOne({"origin": f["origin"], "destination": f["destination"]}, {"$set": f}, upsert=True) for f in FREIGHT_RATES_SEED]
        for row in rows("freight"):
            if row.get("destination"):
                freight_ops.append(UpdateOne({"origin": "Gujarat", "destination": row["destination"]}, {"$set": {
                    "product_code": "COTTON_YARN", "origin": "Gujarat", "destination": row["destination"],
                    "amount": row.get("amount") or 0, "currency": "USD", "unit": "PER_FCL",
                }}, upsert=True))
        if freight_ops:
            db["freight_rates"].bulk_write(freight_ops, ordered=False)
        pushed["freight_rates"] = len(freight_ops)

        db["container_configs"].bulk_write([UpdateOne({"container_type": c["container_type"]}, {"$set": c}, upsert=True) for c in CONTAINER_CONFIGS_SEED], ordered=False)
        pushed["container_configs"] = len(CONTAINER_CONFIGS_SEED)
        db["margin_terms"].bulk_write([UpdateOne({"term_code": m["term_code"]}, {"$set": m}, upsert=True) for m in MARGIN_TERMS_SEED], ordered=False)
        pushed["margin_terms"] = len(MARGIN_TERMS_SEED)
        db["quantity_master"].bulk_write([UpdateOne({"packing_type": q["packing_type"]}, {"$set": q}, upsert=True) for q in QUANTITY_MASTER_SEED], ordered=False)
        pushed["quantity_master"] = len(QUANTITY_MASTER_SEED)
        fx_seed = _exchange_rates_seed()
        db["exchange_rates"].bulk_write([UpdateOne({"currency_pair": f["currency_pair"]}, {"$set": f}, upsert=True) for f in fx_seed], ordered=False)
        pushed["exchange_rates"] = len(fx_seed)

        # D. Costing records (saved quotes)
        saved_quotes = browser_payload.get("savedQuotes") or []
        if saved_quotes:
            ops = []
            for q in saved_quotes:
                ref = q.get("quote_number") or q.get("reference_no") or q.get("id") or f"QT-{now_ms()}"
                ops.append(UpdateOne({"reference_no": ref}, {"$set": {
                    "reference_no": ref, "quote_number": ref,
                    "customer_name": q.get("customer_name") or "Generic Customer",
                    "destination_country": q.get("destination_country") or "",
                    "yarn_count_name": q.get("yarn_count_name") or "",
                    "container_type": q.get("container_type") or "40FT_HC",
                    "cif_price_usd_per_kg": q.get("cif_price_usd_per_kg") or 0,
                    "total_net_profit_usd": q.get("total_net_profit_usd") or 0,
                    "inputs": q.get("inputs") or {}, "outputs": q.get("outputs") or q.get("results") or {},
                    "created_at": q.get("created_at") or timestamp,
                }}, upsert=True))
            db["costing_records"].bulk_write(ops, ordered=False)
        pushed["costing_records"] = len(saved_quotes)

        # E/F. Leads and campaign templates
        drip = _drip_store()
        leads = drip.get("leads") or drip_seed()["leads"]
        if leads:
            db["leads"].bulk_write(
                [UpdateOne({"id": ld.get("id") or f"lead_{i + 1}"}, {"$set": ld}, upsert=True) for i, ld in enumerate(leads)],
                ordered=False,
            )
        pushed["leads"] = len(leads)
        templates = drip.get("templates") or drip_seed()["templates"]
        if templates:
            db["campaign_templates"].bulk_write([UpdateOne({"id": t["id"]}, {"$set": t}, upsert=True) for t in templates], ordered=False)
        pushed["campaign_templates"] = len(templates)

        # G. Zoho accounts
        zoho_items = browser_payload.get("zohoAccounts") or []
        if not zoho_items:
            zoho_items = (_read_local_json("zoho_accounts_cache.json") or {}).get("items") or zoho_fallback_accounts()
        top = zoho_items[:500]
        ops = [UpdateOne({"id": a["id"]}, {"$set": a}, upsert=True) for a in top if isinstance(a, dict) and a.get("id")]
        if ops:
            db["zoho_accounts"].bulk_write(ops, ordered=False)
        pushed["zoho_accounts"] = len(top)

        # H. Users
        users = system_users()
        db["users"].bulk_write([UpdateOne({"email": u["email"]}, {"$set": {
            "id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"], "title": u["title"],
            "active": True, "createdAt": timestamp,
        }}, upsert=True) for u in users], ordered=False)
        pushed["users"] = len(users)

        # I. Audit log
        db["audit_logs"].insert_one({
            "id": f"mig_{now_ms()}", "action": "DATA_MIGRATION_PUSH",
            "user_name": (browser_payload.get("userSession") or {}).get("name") or "Admin",
            "details": f"Pushed application data across {len(pushed)} collections",
            "itemsPushed": dict(pushed), "timestamp": timestamp,
        })
        pushed["audit_logs"] = 1

        total = sum(pushed.values())
        return {
            "success": True, "dbName": DB_NAME, "itemsPushed": pushed, "connection": conn,
            "message": f"Successfully pushed all data to MongoDB ({total} total records across {len(pushed)} collections).",
            "timestamp": timestamp,
        }
    finally:
        client.close()
