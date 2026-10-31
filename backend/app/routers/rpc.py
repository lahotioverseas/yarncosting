"""/api/rpc/* - costing RPCs ({data, error} envelope), master data, saved quotes."""
from __future__ import annotations

import random
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from ..http import body_dict, read_body, read_params, respond
from ..services import costing, fx, persistence, pricing_store
from ..services.jsutil import iso_now, js_or, js_string, now_ms, to_base36

router = APIRouter(prefix="/api/rpc")

LOCKED_CALC_MSG = (
    "Prices are locked at 00:00 AM IST. Admin must confirm today's prices or keep yesterday's prices "
    "before calculations can be run."
)
LOCKED_QUOTE_MSG = (
    "Prices are locked at 00:00 AM IST. Admin must confirm today's prices or keep yesterday's prices "
    "before quotations can be generated."
)

# In-memory master data for the RPC emulator (same seed as before)
PRODUCTS = [{
    "id": "p_cotton_01", "code": "COTTON_YARN", "name": "Cotton Yarn",
    "description": "100% Cotton Yarn for Export Weaving & Hosiery", "active": True,
}]
YARN_COUNTS = [
    {"id": "yc_20c", "product_code": "COTTON_YARN", "count_name": "20s Carded", "yarn_type": "Carded", "purpose": "Weaving", "standard_bag_weight_kg": 60.00, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
    {"id": "yc_30ch", "product_code": "COTTON_YARN", "count_name": "30s Combed Hosiery", "yarn_type": "Combed", "purpose": "Hosiery", "standard_bag_weight_kg": 60.00, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
    {"id": "yc_40cw", "product_code": "COTTON_YARN", "count_name": "40s Compact Weaving", "yarn_type": "Compact", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
    {"id": "yc_50c", "product_code": "COTTON_YARN", "count_name": "50s Combed", "yarn_type": "Combed", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
    {"id": "yc_60c", "product_code": "COTTON_YARN", "count_name": "60s Combed", "yarn_type": "Combed", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
    {"id": "yc_80c", "product_code": "COTTON_YARN", "count_name": "80s Compact", "yarn_type": "Compact", "purpose": "Weaving", "standard_bag_weight_kg": 45.36, "rodtep_rate_pct": 1.70, "drawback_rate_pct": 1.50},
]
CONTAINER_CONFIGS = [
    {"id": "cc_20ft", "product_code": "COTTON_YARN", "container_type": "20FT_FCL", "display_name": "20ft Standard FCL Container", "max_capacity_kg": 18000.00, "bags_count": 300},
    {"id": "cc_40hc", "product_code": "COTTON_YARN", "container_type": "40FT_HC", "display_name": "40ft High Cube Container", "max_capacity_kg": 24500.00, "bags_count": 540},
]
PORT_LOGISTICS = [
    {"id": "port_mundra", "port_name": "Mundra Port", "thc_charge_inr": 11500.00, "cha_clearance_inr": 4500.00, "doc_bl_fee_inr": 3500.00, "inspection_fee_inr": 2500.00, "inland_freight_inr": 18000.00, "other_fob_charges_inr": 2000.00},
    {"id": "port_nhava", "port_name": "Nhava Sheva (JNPT)", "thc_charge_inr": 12500.00, "cha_clearance_inr": 4800.00, "doc_bl_fee_inr": 3500.00, "inspection_fee_inr": 2500.00, "inland_freight_inr": 22000.00, "other_fob_charges_inr": 2000.00},
    {"id": "port_tuticorin", "port_name": "Tuticorin Port", "thc_charge_inr": 10500.00, "cha_clearance_inr": 4200.00, "doc_bl_fee_inr": 3000.00, "inspection_fee_inr": 2000.00, "inland_freight_inr": 14000.00, "other_fob_charges_inr": 1800.00},
    {"id": "port_chennai", "port_name": "Chennai Port", "thc_charge_inr": 11000.00, "cha_clearance_inr": 4400.00, "doc_bl_fee_inr": 3200.00, "inspection_fee_inr": 2200.00, "inland_freight_inr": 16000.00, "other_fob_charges_inr": 2000.00},
]
FINANCIAL_PARAMS = [
    {"id": "fin_cotton_01", "product_code": "COTTON_YARN", "packing_credit_interest_pct_pa": 8.50, "ecgc_premium_pct": 0.25, "bank_lc_discounting_pct": 1.20, "trader_margin_pct": 3.00, "agent_commission_pct": 1.50, "insurance_rate_pct": 0.10},
]

SAVED_QUOTES = "saved_quotes"  # MongoDB collection (memory fallback)


def add_saved_quote(quote: dict[str, Any]) -> None:
    persistence.insert_record(SAVED_QUOTES, quote)


def new_saved_quote_id() -> str:
    return "sq_" + to_base36(now_ms())


def random_quote_number() -> str:
    return f"QT-{datetime.now().year}-{random.randint(1000, 9999)}"


def _ok(data: Any) -> Any:
    return respond({"data": data, "error": None})


@router.post("/get_products")
async def get_products():
    return _ok(costing.get_products())


@router.post("/get_freight_origins")
async def get_freight_origins(request: Request):
    body = body_dict(await read_body(request))
    return _ok(costing.get_freight_origins(body.get("p_product_code")))


@router.post("/get_freight_destinations")
async def get_freight_destinations(request: Request):
    body = body_dict(await read_body(request))
    return _ok(costing.get_freight_destinations(body.get("p_product_code"), body.get("p_origin")))


@router.post("/get_freight_rate")
async def get_freight_rate(request: Request):
    body = body_dict(await read_body(request))
    data = await run_in_threadpool(costing.get_freight_rate, body.get("p_product_code"), body.get("p_origin"), body.get("p_destination"))
    return _ok(data)


@router.post("/get_fob_locations")
async def get_fob_locations(request: Request):
    return _ok(costing.get_fob_locations())


@router.post("/get_quantity_options")
async def get_quantity_options(request: Request):
    return _ok(costing.get_quantity_options())


@router.post("/get_margin_terms")
async def get_margin_terms(request: Request):
    return _ok(costing.get_margin_terms())


@router.post("/get_exchange_rates")
async def get_exchange_rates(request: Request):
    await run_in_threadpool(fx.ensure_fresh)
    return _ok(fx.get_exchange_rates())


@router.post("/refresh_exchange_rates")
async def refresh_exchange_rates():
    data = await run_in_threadpool(fx.refresh_exchange_rates)
    return _ok(data)


@router.api_route("/calculate_costing", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def calculate_costing(request: Request):
    try:
        status = await run_in_threadpool(pricing_store.get_daily_pricing_status)
        if not status["isConfirmedForToday"]:
            return respond({"data": None, "error": LOCKED_CALC_MSG})
        params = await read_params(request)
        await run_in_threadpool(fx.ensure_fresh)
        data = await run_in_threadpool(costing.calculate_costing, params)
        return _ok(data)
    except Exception as err:
        return respond({"data": None, "error": str(err) or "Error in calculate_costing"})


@router.api_route("/save_costing", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def save_costing(request: Request):
    try:
        status = await run_in_threadpool(pricing_store.get_daily_pricing_status)
        if not status["isConfirmedForToday"]:
            return respond({"data": None, "error": LOCKED_QUOTE_MSG})
        params = await read_params(request)
        ref = await run_in_threadpool(costing.save_costing, params.get("p_inputs"), params.get("p_outputs"))
        return _ok(ref)
    except Exception as err:
        return respond({"data": None, "error": str(err) or "Error in save_costing"})


@router.api_route("/replay_costing", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def replay_costing(request: Request):
    try:
        params = await read_params(request)
        await run_in_threadpool(fx.ensure_fresh)
        data = await run_in_threadpool(costing.replay_costing, params.get("p_reference_no"))
        return _ok(data)
    except Exception as err:
        return respond({"data": None, "error": str(err) or "Error in replay_costing"})


@router.api_route("/calculate_cotton_yarn_costing", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def calculate_cotton_yarn_costing(request: Request):
    try:
        params = await read_params(request)
        payload = params.get("p_input") or params
        return _ok(costing.calculate_cotton_yarn_costing(payload if isinstance(payload, dict) else {}))
    except Exception as err:
        return respond({"data": None, "error": str(err) or "Error in calculate_cotton_yarn_costing"}, 500)


@router.post("/get_master_data")
async def get_master_data():
    await run_in_threadpool(fx.ensure_fresh)
    return _ok({
        "products": PRODUCTS,
        "yarnCounts": YARN_COUNTS,
        "containerConfigs": CONTAINER_CONFIGS,
        "portLogistics": PORT_LOGISTICS,
        "financialParams": FINANCIAL_PARAMS,
        "fxRates": fx.fx_rates_master,
    })


def _merge_by(items: list[dict[str, Any]], key: str, record: dict[str, Any]) -> None:
    for i, item in enumerate(items):
        if item.get(key) == record.get(key):
            items[i] = {**item, **record}


@router.post("/update_master_data")
async def update_master_data(request: Request):
    body = body_dict(await read_body(request))
    target, record = body.get("target_table"), body.get("record") or {}
    try:
        if target == "yarn_counts_master":
            _merge_by(YARN_COUNTS, "id", record)
        elif target == "port_logistics_master":
            _merge_by(PORT_LOGISTICS, "id", record)
        elif target == "financial_params_master":
            _merge_by(FINANCIAL_PARAMS, "id", record)
        elif target == "fx_rates_master":
            for i, item in enumerate(fx.fx_rates_master):
                if item.get("currency_pair") == record.get("currency_pair"):
                    buffer = js_or(record.get("fx_buffer_margin"), item.get("fx_buffer_margin"))
                    fx.fx_rates_master[i] = {
                        **item,
                        **record,
                        "effective_rate": record.get("rate") - buffer,
                        "last_updated_at": iso_now(),
                    }
        return _ok({"success": True})
    except Exception as err:
        return respond({"data": None, "error": str(err)}, 500)


@router.post("/get_fx_rates")
async def get_fx_rates():
    await run_in_threadpool(fx.ensure_fresh)
    return _ok(fx.fx_rates_master)


@router.post("/refresh_fx_rates")
async def refresh_fx_rates():
    try:
        await run_in_threadpool(fx.refresh_exchange_rates)
        return _ok(fx.fx_rates_master)
    except Exception as err:
        return respond({"data": fx.fx_rates_master, "error": f"Failed to fetch live FX rates: {err}"})


@router.post("/save_costing_quote")
async def save_costing_quote(request: Request):
    try:
        body = body_dict(await read_body(request))
        q = body.get("p_quote") or body
        inputs, results = q["inputs"], q["results"]
        quote = {
            "id": new_saved_quote_id(),
            "quote_number": q.get("quote_number") or random_quote_number(),
            "customer_name": q.get("customer_name") or "Valued Customer",
            "destination_country": q.get("destination_country") or "Global",
            "yarn_count_name": inputs.get("yarn_count_name"),
            "container_type": inputs.get("container_type"),
            "cif_price_usd_per_kg": results.get("cif_price_usd_per_kg"),
            "total_net_profit_usd": results.get("total_net_profit_usd"),
            "created_at": iso_now(),
            "inputs": inputs,
            "results": results,
        }
        await run_in_threadpool(add_saved_quote, quote)
        return _ok(quote)
    except Exception as err:
        return respond({"data": None, "error": js_string(err) if not str(err) else str(err)}, 500)


@router.post("/get_saved_quotes")
async def get_saved_quotes():
    return _ok(await run_in_threadpool(persistence.list_records, SAVED_QUOTES))


@router.post("/delete_saved_quote")
async def delete_saved_quote(request: Request):
    body = body_dict(await read_body(request))
    await run_in_threadpool(persistence.delete_records, SAVED_QUOTES, "id", body.get("id"))
    return _ok({"success": True})
