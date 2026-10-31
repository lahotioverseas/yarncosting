"""Cotton yarn costing RPC handlers. Port of frontend/src/lib/rpcHandlers.ts and
plpgsqlEngine.ts (formula specs in README: +$25 freight rule, +0.50 FX pad,
5% DDB/RoDTEP, USD/EUR asymmetry, reverse target costing)."""
from __future__ import annotations

import math
import random
from datetime import datetime
from typing import Any, Callable

from . import fx, persistence
from .jsutil import (
    UNDEFINED,
    div,
    get,
    is_nan,
    is_nullish,
    iso_now,
    js_number,
    js_or,
    js_string,
    nullish,
    to_fixed,
    truthy,
    utc_date_str,
)

# Freight master (exact data from Ocean Freight Master)
FREIGHT_RATES: list[dict[str, Any]] = [
    {"origin": "Gujarat", "destination": "Cat Lai", "amount": 300},
    {"origin": "Gujarat", "destination": "Callao", "amount": 2900},
    {"origin": "Gujarat", "destination": "EL DEKHILA /Ale", "amount": 2750},
    {"origin": "Gujarat", "destination": "Istanbul", "amount": 2875},
    {"origin": "Gujarat", "destination": "Lexious", "amount": 3075},
    {"origin": "Gujarat", "destination": "Hamburg", "amount": 2675},
    {"origin": "Gujarat", "destination": "Chittagong", "amount": 950},
    {"origin": "Gujarat", "destination": "Itajai", "amount": None},
    {"origin": "Gujarat", "destination": "Qingdao/SH", "amount": 200},
    {"origin": "Gujarat", "destination": "Psair Gudang", "amount": 300},
    {"origin": "Gujarat", "destination": "Buenaventura", "amount": 2750},
    {"origin": "Gujarat", "destination": "Port Louis", "amount": 2100},
    {"origin": "Gujarat", "destination": "Gdynia", "amount": 2050},
    {"origin": "Gujarat", "destination": "LA, USA", "amount": None},
    {"origin": "Gujarat", "destination": "Colombo", "amount": 600},
    {"origin": "Gujarat", "destination": "Wuhu", "amount": 300},
    {"origin": "Gujarat", "destination": "Al Sokhna", "amount": 3600},
    {"origin": "Gujarat", "destination": "Casablanca", "amount": 2950},
    {"origin": "Gujarat", "destination": "Lazaro Cardenas", "amount": 3200},
    {"origin": "Gujarat", "destination": "Tunis", "amount": 2950},
    {"origin": "Gujarat", "destination": "Santos", "amount": None},
    {"origin": "Gujarat", "destination": "Puerto quetzal", "amount": None},
    {"origin": "Maharashtra", "destination": "Port Louis", "amount": 2100},
    {"origin": "Maharashtra", "destination": "Casablanca", "amount": 2900},
    {"origin": "Chennai", "destination": "Puerto quetzal", "amount": 4065},
]

FOB_RATES: list[dict[str, Any]] = [
    {"id": 1, "location": "FOB Costing", "variant_label": "Standard", "display_label": "FOB Costing (₹70,000)", "amount": 70000},
    {"id": 2, "location": "Mundra", "variant_label": "Port", "display_label": "Mundra (₹62,000)", "amount": 62000},
    {"id": 3, "location": "North", "variant_label": "Region", "display_label": "North (₹1,00,000)", "amount": 100000},
    {"id": 4, "location": "Maharastra", "variant_label": "State", "display_label": "Maharastra (₹85,000)", "amount": 85000},
    {"id": 5, "location": "Andhra", "variant_label": "State", "display_label": "Andhra (₹85,000)", "amount": 85000},
    {"id": 6, "location": "TN", "variant_label": "State", "display_label": "TN (₹70,000)", "amount": 70000},
    {"id": 7, "location": "Nagpur", "variant_label": "Location", "display_label": "Nagpur (₹1,23,000)", "amount": 123000},
    {"id": 8, "location": "Pusad", "variant_label": "Location", "display_label": "Pusad (₹1,20,000)", "amount": 120000},
    {"id": 9, "location": "Biratnagar", "variant_label": "15 tons", "display_label": "Biratnagar 15 tons (₹1,69,000)", "amount": 169000},
    {"id": 10, "location": "Katmandu", "variant_label": "Location", "display_label": "Katmandu (₹2,20,000)", "amount": 220000},
    {"id": 11, "location": "Biratnagar", "variant_label": "23 tons — Route A", "display_label": "Biratnagar 23 tons (₹2,40,000)", "amount": 240000},
    {"id": 12, "location": "Biratnagar", "variant_label": "23 tons — Route B", "display_label": "Biratnagar 23 tons (₹1,35,000)", "amount": 135000},
    {"id": 13, "location": "keytex", "variant_label": "Location", "display_label": "keytex (₹1,20,000)", "amount": 120000},
]

QUANTITY_OPTIONS: list[dict[str, Any]] = [
    {"id": 1, "packing_type": "Cartons", "qty_per_fcl": 21319.20, "is_default": True},
    {"id": 2, "packing_type": "Pallets", "qty_per_fcl": 19500, "is_default": False},
    {"id": 3, "packing_type": "Double yarn carton", "qty_per_fcl": 20412, "is_default": False},
    {"id": 4, "packing_type": "OE yarn Pallet", "qty_per_fcl": 19000, "is_default": False},
    {"id": 5, "packing_type": "OE yarn carton", "qty_per_fcl": 19000, "is_default": False},
]

MARGIN_TERMS: list[dict[str, Any]] = [
    {"id": 1, "term_code": "LC_SIGHT", "term_label": "LC at sight", "margin_pct": 3.0, "is_default": True},
    {"id": 2, "term_code": "20_80", "term_label": "20/80", "margin_pct": 3.0, "is_default": False},
    {"id": 3, "term_code": "LC_30_DAYS", "term_label": "Lc 30 days from BL date", "margin_pct": 3.0, "is_default": False},
    {"id": 4, "term_code": "LC_60_DAYS", "term_label": "Lc 60 days from BL date", "margin_pct": 3.25, "is_default": False},
    {"id": 5, "term_code": "LC_90_DAYS", "term_label": "Lc 90 days", "margin_pct": 3.5, "is_default": False},
    {"id": 6, "term_code": "LC_120_DAYS", "term_label": "Lc 120 days from BL date", "margin_pct": 4.0, "is_default": False},
    {"id": 7, "term_code": "LC_150_DAYS", "term_label": "Lc 150 days from BL date", "margin_pct": 4.5, "is_default": False},
]

# Saved costings for replay (MongoDB `costing_records`, memory fallback)
COSTING_RECORDS = "costing_records"

# Supplies the live freight rows from the Daily Pricing store (set by pricing_store at import)
dynamic_freight_rows_provider: Callable[[], list[dict[str, Any]]] = lambda: []


def get_margin_terms_for_destination(destination: Any) -> list[dict[str, Any]]:
    dest = (js_string(destination) if truthy(destination) else "").lower()
    is_china_vietnam = "qingdao" in dest or "shanghai" in dest or "cat lai" in dest or "wuhu" in dest
    is_south_america = (
        "callao" in dest or "buenaventura" in dest or "santos" in dest or "lazaro cardenas" in dest or "quetzal" in dest
    )
    is_chittagong = "chittagong" in dest

    if is_china_vietnam:
        return [
            {"id": 1, "term_code": "LC_SIGHT", "term_label": "LC at sight", "margin_pct": 2.0, "is_default": True},
            {"id": 2, "term_code": "20_80", "term_label": "20/80", "margin_pct": 2.0, "is_default": False},
            {"id": 3, "term_code": "LC_30_DAYS", "term_label": "Lc 30 days from BL date", "margin_pct": 2.5, "is_default": False},
            {"id": 4, "term_code": "LC_45_DAYS", "term_label": "Lc 45 days from BL date", "margin_pct": 2.5, "is_default": False},
            {"id": 5, "term_code": "LC_60_DAYS", "term_label": "Lc 60 days from BL date", "margin_pct": 2.75, "is_default": False},
            {"id": 6, "term_code": "LC_90_DAYS", "term_label": "Lc 90 days from BL date", "margin_pct": 3.0, "is_default": False},
        ]
    if is_south_america:
        return [
            {"id": 1, "term_code": "20_80", "term_label": "20/80", "margin_pct": 3.5, "is_default": True},
            {"id": 2, "term_code": "LC_SIGHT", "term_label": "LC at sight", "margin_pct": 3.5, "is_default": False},
            {"id": 3, "term_code": "LC_90_DAYS", "term_label": "Lc 90 days from BL date", "margin_pct": 4.5, "is_default": False},
        ]
    add = 0.25 if is_chittagong else 0
    return [
        {"id": 1, "term_code": "20_80", "term_label": "20/80", "margin_pct": 3.0 + add, "is_default": False},
        {"id": 2, "term_code": "LC_SIGHT", "term_label": "LC at sight", "margin_pct": 3.0 + add, "is_default": True},
        {"id": 3, "term_code": "LC_30_DAYS", "term_label": "Lc 30 days from BL date", "margin_pct": 3.0 + add, "is_default": False},
        {"id": 4, "term_code": "LC_60_DAYS", "term_label": "Lc 60 days from BL date", "margin_pct": 3.25 + add, "is_default": False},
        {"id": 5, "term_code": "LC_90_DAYS", "term_label": "Lc 90 days", "margin_pct": 3.5 + add, "is_default": False},
        {"id": 6, "term_code": "LC_120_DAYS", "term_label": "Lc 120 days from BL date", "margin_pct": 4.0 + add, "is_default": False},
        {"id": 7, "term_code": "LC_150_DAYS", "term_label": "Lc 150 days from BL date", "margin_pct": 4.5 + add, "is_default": False},
    ]


def get_products() -> list[dict[str, Any]]:
    return [{"id": 1, "code": "COTTON", "name": "Cotton Yarn"}]


def get_freight_origins(_product_code: Any = None) -> list[dict[str, Any]]:
    origins = sorted({f["origin"] for f in FREIGHT_RATES if f["amount"] is not None})
    return [{"origin": o} for o in origins]


def get_freight_destinations(_product_code: Any = None, origin: Any = None) -> list[dict[str, Any]]:
    if truthy(origin):
        dests = sorted(f["destination"] for f in FREIGHT_RATES if f["origin"] == origin and f["amount"] is not None)
        return [{"destination": d} for d in dests]
    dests = sorted({f["destination"] for f in FREIGHT_RATES if f["amount"] is not None})
    return [{"destination": d} for d in dests]


def get_freight_rate(_product_code: Any = None, origin: Any = None, destination: Any = None) -> dict[str, Any]:
    if not truthy(destination):
        return {"base_amount_usd": None, "surcharge": 25, "selected_freight_usd": None, "origin": None, "available": False}

    destination = js_string(destination)
    record = None
    if truthy(origin):
        record = next((f for f in FREIGHT_RATES if f["origin"] == origin and f["destination"] == destination), None)
    if record is None or record["amount"] is None:
        record = (
            next(
                (f for f in FREIGHT_RATES if f["destination"].lower() == destination.lower() and f["amount"] is not None),
                None,
            )
            or record
        )

    # Also check the live Daily Pricing freight sheet (e.g. destinations added by Admin)
    if record is None or record["amount"] is None:
        target = destination.lower().strip()
        dyn = next(
            (r for r in dynamic_freight_rows_provider() if js_string(r.get("destination") or "").lower().strip() == target),
            None,
        )
        if dyn is not None and not is_nullish(dyn.get("amount")) and js_number(dyn.get("amount")) > 0:
            record = {
                "origin": origin if truthy(origin) else "Gujarat",
                "destination": dyn.get("destination"),
                "amount": js_number(dyn.get("amount")),
            }

    if record is None or record["amount"] is None:
        return {
            "base_amount_usd": None,
            "surcharge": 25,
            "selected_freight_usd": None,
            "origin": (record or {}).get("origin") or (origin if truthy(origin) else None),
            "available": False,
        }
    return {
        "base_amount_usd": record["amount"],
        "surcharge": 25,
        "selected_freight_usd": record["amount"] + 25,
        "origin": record["origin"],
        "available": True,
    }


def get_fob_locations(_product_code: Any = None) -> list[dict[str, Any]]:
    return FOB_RATES


def get_quantity_options(_product_code: Any = None) -> list[dict[str, Any]]:
    return QUANTITY_OPTIONS


def get_margin_terms(_product_code: Any = None) -> list[dict[str, Any]]:
    return MARGIN_TERMS


def _positive_number(v: Any) -> bool:
    """params.x != null && !isNaN(Number(params.x)) && Number(params.x) > 0"""
    return not is_nullish(v) and not is_nan(v) and js_number(v) > 0


def calculate_costing(params: dict[str, Any]) -> dict[str, Any]:
    p = lambda k: get(params, k)  # noqa: E731

    product_code = js_or(p("p_product_code"), "COTTON")
    ex_mill = js_number(p("p_ex_mill"))
    origin = p("p_origin")
    destination = p("p_destination")
    fob_rate_id = js_number(p("p_fob_rate_id"))
    qty = js_number(p("p_qty"))
    bci = js_number(js_or(p("p_bci"), 0))
    commission_type = "USD_PER_KG" if p("p_commission_type") == "USD_PER_KG" else "PCT"
    commission_val = js_number(
        p("p_commission_value") if not is_nullish(p("p_commission_value")) else nullish(p("p_commission_pct"), 0)
    )
    margin_term_code = js_or(p("p_margin_term_code"), "LC_SIGHT")
    target_usd = js_number(p("p_target_usd")) if not is_nullish(p("p_target_usd")) else None

    # FOB amount (direct from Sheet 2 or from ID master)
    if _positive_number(p("p_fob_amount")):
        fob_amount = js_number(p("p_fob_amount"))
    else:
        fob_record = next((f for f in FOB_RATES if f["id"] == fob_rate_id), None)
        fob_amount = fob_record["amount"] if fob_record else 70000

    # Freight (direct from Sheet 3 or master lookup)
    surcharge = 25.0
    if _positive_number(p("p_selected_freight_usd")):
        selected_freight_usd = js_number(p("p_selected_freight_usd"))
        surcharge = js_number(js_or(p("p_freight_surcharge"), 25))
    elif _positive_number(p("p_base_freight_usd")):
        base_freight_usd = js_number(p("p_base_freight_usd"))
        surcharge = js_number(js_or(p("p_freight_surcharge"), 25))
        selected_freight_usd = base_freight_usd + surcharge
    else:
        freight_res = get_freight_rate(product_code, origin, destination)
        if not freight_res["available"] or freight_res["base_amount_usd"] is None:
            raise ValueError("no freight rate published for this route")
        base_freight_usd = freight_res["base_amount_usd"]
        surcharge = js_or(freight_res["surcharge"], 25)
        selected_freight_usd = base_freight_usd + surcharge

    # FX resolution
    store = fx.exchange_rates_store
    if not is_nullish(p("p_usd_inr")):
        usd_inr = js_number(p("p_usd_inr"))
    else:
        usd_inr = nullish((store.get("USD") or {}).get("rate"), 95.43)

    eur_unavailable = False
    if p("p_eur_inr") is not UNDEFINED:
        eur_inr = js_number(p("p_eur_inr")) if not is_nullish(p("p_eur_inr")) else None
        if eur_inr is None:
            eur_unavailable = True
    else:
        eur_inr = nullish((store.get("EUR") or {}).get("rate"), 111.36)

    # Margin % from destination port rules
    dest_terms = get_margin_terms_for_destination(destination)
    margin_record = next((m for m in dest_terms if m["term_code"] == margin_term_code), None) or next(
        (m for m in MARGIN_TERMS if m["term_code"] == margin_term_code), None
    )
    margin_pct = margin_record["margin_pct"] if margin_record else 3.0

    fx_pad = 0.50
    padded_rate = usd_inr + fx_pad
    ddb_rodtep_pct = 5.0
    ddb_rodtep = ex_mill * (ddb_rodtep_pct / 100.0)
    net_ex_mill = ex_mill - ddb_rodtep
    fob_cost_per_kg = div(fob_amount, qty)
    freight_per_kg = div(selected_freight_usd * padded_rate, qty)
    total_cost = net_ex_mill + fob_cost_per_kg + freight_per_kg
    base_amount = total_cost + bci

    if commission_type == "USD_PER_KG":
        commission_usd = commission_val
        commission_inr = commission_val * usd_inr
        effective_commission_pct = (commission_inr / base_amount) * 100.0 if base_amount > 0 else 0
    else:
        effective_commission_pct = commission_val
        commission_inr = base_amount * (commission_val / 100.0)
        commission_usd = commission_inr / usd_inr if usd_inr > 0 else 0

    interest_amt = commission_inr
    margin_amt = base_amount * (margin_pct / 100.0)
    final_inr = base_amount + interest_amt + margin_amt

    usd_price = div(final_inr, usd_inr)
    eur_price = (
        (base_amount + (base_amount * margin_pct / 100.0) + commission_inr) / eur_inr
        if (truthy(eur_inr) and eur_inr > 0)
        else None
    )

    target_calc = None
    if target_usd is not None and target_usd > 0:
        target_inr = target_usd * usd_inr
        allowed_ex_mill = target_inr - bci - freight_per_kg - fob_cost_per_kg
        with_buffer = allowed_ex_mill * 1.05
        after_interest = (
            with_buffer - commission_inr
            if commission_type == "USD_PER_KG"
            else with_buffer - (with_buffer * (effective_commission_pct / 100.0))
        )
        final_target = after_interest - (after_interest * (margin_pct / 100.0))
        target_calc = {
            "target_usd": target_usd,
            "target_inr": target_inr,
            "allowed_ex_mill": allowed_ex_mill,
            "with_buffer": with_buffer,
            "after_interest": after_interest,
            "final_target": final_target,
        }

    return {
        "ex_mill_price": ex_mill,
        "qty_per_fcl": qty,
        "selected_freight_usd": selected_freight_usd,
        "ddb_rodtep": ddb_rodtep,
        "net_ex_mill": net_ex_mill,
        "fob_cost_per_kg": fob_cost_per_kg,
        "padded_rate": padded_rate,
        "freight_per_kg": freight_per_kg,
        "total_cost": total_cost,
        "usd_price": usd_price,
        "eur_price": eur_price,
        "eur_unavailable": eur_unavailable,
        "commission_type": commission_type,
        "commission_value": commission_val,
        "commission_inr": commission_inr,
        "commission_usd": commission_usd,
        "effective_commission_pct": effective_commission_pct,
        "target_calc": target_calc,
        "fx": {
            "usd_inr": usd_inr,
            "eur_inr": eur_inr,
            "rate_date": utc_date_str(),
            "is_fallback": False,
            "padded_usd_inr": padded_rate,
            "eur_unavailable": eur_unavailable,
        },
        "assumptions": {
            "ddb_rodtep_pct": ddb_rodtep_pct,
            "interest_comm_pct": effective_commission_pct,
            "commission_type": commission_type,
            "commission_value": commission_val,
            "margin_pct": margin_pct,
            "fx_pad": fx_pad,
            "freight_surcharge": surcharge,
            "target_buffer_factor": 1.05,
        },
    }


def new_quote_ref() -> str:
    return f"QT-{datetime.now().year}-{random.randint(1000, 9999)}"


def save_costing(p_inputs: Any, p_outputs: Any) -> str:
    ref_no = new_quote_ref()
    outputs_fx = (p_outputs or {}).get("fx") if isinstance(p_outputs, dict) else None
    if not isinstance(outputs_fx, dict):
        raise ValueError("Cannot read properties of undefined (reading 'usd_inr')")
    record = {
        "reference_no": ref_no,
        "created_at": iso_now(),
        "inputs": p_inputs,
        "outputs": p_outputs,
    }
    # keys left out when absent so replay can tell "missing" (use live FX) from null (EUR unavailable)
    if "usd_inr" in outputs_fx:
        record["usd_inr_used"] = outputs_fx["usd_inr"]
    if "eur_inr" in outputs_fx:
        record["eur_inr_used"] = outputs_fx["eur_inr"]
    persistence.insert_record(COSTING_RECORDS, record)
    return ref_no


def replay_costing(p_reference_no: Any) -> dict[str, Any]:
    record = persistence.find_record(COSTING_RECORDS, "reference_no", p_reference_no)
    if record is None:
        raise ValueError(f"Reference {js_string(p_reference_no)} not found")
    inputs = record.get("inputs") or {}
    params = {
        **inputs,
        "p_product_code": inputs.get("product_code") or "COTTON",
        "p_ex_mill": inputs.get("ex_mill", UNDEFINED),
        "p_origin": inputs.get("origin", UNDEFINED),
        "p_destination": inputs.get("destination", UNDEFINED),
        "p_fob_rate_id": inputs.get("fob_rate_id", UNDEFINED),
        "p_qty": inputs.get("qty", UNDEFINED),
        "p_bci": inputs.get("bci", UNDEFINED),
        "p_margin_term_code": inputs.get("margin_term_code", UNDEFINED),
        "p_target_usd": inputs.get("target_usd", UNDEFINED),
        "p_usd_inr": record.get("usd_inr_used", UNDEFINED),
        "p_eur_inr": record.get("eur_inr_used", UNDEFINED),
    }
    # strip sentinel keys so get() sees them as missing (JS `undefined`)
    params = {k: v for k, v in params.items() if v is not UNDEFINED}
    return calculate_costing(params)


# ---------------------------------------------------------------------------
# calculate_cotton_yarn_costing (PL/pgSQL mirror, full-container legacy view)
# ---------------------------------------------------------------------------

def calculate_cotton_yarn_costing(inp: dict[str, Any]) -> dict[str, Any]:
    g = lambda k: get(inp, k)  # noqa: E731

    currency_code = js_or(g("currency_code"), "USD")
    ex_mill_price = js_number(g("ex_mill_price_inr_per_kg"))
    qty_per_fcl = js_or(js_number(g("container_capacity_kg")), 21000.0)
    fob_amount = js_number(g("total_port_fob_expenses_inr"))
    base_freight_usd = js_number(g("ocean_freight_usd")) if not is_nullish(g("ocean_freight_usd")) else 950.0
    freight_surcharge = 25.0
    fx_pad = 0.50

    usd_inr = js_or(js_number(g("base_fx_rate")), 83.50)
    eur_inr = js_number(g("eur_inr")) if truthy(g("eur_inr")) else 90.20

    ddb_rodtep_pct = js_number(nullish(g("rodtep_rebate_pct"), 5.0))
    commission_type = "USD_PER_KG" if g("commission_type") == "USD_PER_KG" else "PCT"
    commission_val = js_number(
        g("commission_value")
        if not is_nullish(g("commission_value"))
        else nullish(g("agent_commission_pct"), nullish(g("packing_credit_interest_pct_pa"), 0.0))
    )
    margin_pct = js_number(nullish(g("trader_margin_pct"), 3.0))
    bci_org = js_number(nullish(g("bci_org"), 0.0))
    target_usd = js_number(nullish(g("target_usd"), 2.93))

    selected_freight_usd = base_freight_usd + freight_surcharge
    ddb_rodtep = ex_mill_price * (ddb_rodtep_pct / 100.0)
    net_ex_mill = ex_mill_price - ddb_rodtep
    fob_cost_per_kg = div(fob_amount, js_or(qty_per_fcl, 1))
    padded_rate = usd_inr + fx_pad
    freight_per_kg = div(selected_freight_usd * padded_rate, js_or(qty_per_fcl, 1))
    total_cost = net_ex_mill + fob_cost_per_kg + freight_per_kg
    base_amount = total_cost + bci_org

    if commission_type == "USD_PER_KG":
        commission_usd = commission_val
        commission_inr = commission_val * usd_inr
        effective_comm_pct = (commission_inr / base_amount) * 100.0 if base_amount > 0 else 0
    else:
        effective_comm_pct = commission_val
        commission_inr = base_amount * (commission_val / 100.0)
        commission_usd = commission_inr / usd_inr if usd_inr > 0 else 0

    interest_amt = commission_inr
    margin_amt = base_amount * (margin_pct / 100.0)
    final_inr = base_amount + interest_amt + margin_amt
    usd_price = div(final_inr, usd_inr)

    eur_price = None
    eur_unavailable = False
    if truthy(eur_inr) and eur_inr > 0:
        eur_price = (total_cost + bci_org + (total_cost * (margin_pct / 100.0)) + commission_inr) / eur_inr
    else:
        eur_unavailable = True

    target_inr = target_usd * usd_inr
    allowed_ex_mill = target_inr - bci_org - freight_per_kg - fob_cost_per_kg
    with_buffer = allowed_ex_mill * 1.05
    after_interest = (
        with_buffer - commission_inr
        if commission_type == "USD_PER_KG"
        else with_buffer - (with_buffer * (effective_comm_pct / 100.0))
    )
    final_target = after_interest - (after_interest * (margin_pct / 100.0))

    cif_price_usd = eur_price if (currency_code == "EUR" and eur_price is not None) else usd_price
    cif_price_inr = cif_price_usd * usd_inr
    total_shipment_cost_inr = total_cost * qty_per_fcl
    total_net_profit_inr = margin_amt * qty_per_fcl
    total_net_profit_usd = div(total_net_profit_inr, usd_inr)
    profit_margin_pct = (total_net_profit_inr / total_shipment_cost_inr) * 100.0 if total_shipment_cost_inr > 0 else 0

    fx_sensitivity = []
    shift = -2.0
    while shift <= 2.0:
        s_fx = usd_inr + shift
        if s_fx > 0:
            s_padded = s_fx + fx_pad
            s_freight_kg = div(selected_freight_usd * s_padded, qty_per_fcl)
            s_total_cost = net_ex_mill + fob_cost_per_kg + s_freight_kg
            s_base = s_total_cost + bci_org
            s_final_inr = s_base + (s_base * effective_comm_pct / 100.0) + (s_base * margin_pct / 100.0)
            s_usd_price = s_final_inr / s_fx
            s_profit = margin_amt * qty_per_fcl / s_fx
            fx_sensitivity.append({
                "rate_shift": shift,
                "fx_rate": to_fixed(s_fx, 2),
                "cif_price_usd": to_fixed(s_usd_price, 4),
                "net_profit_usd": to_fixed(s_profit, 2),
            })
        shift += 1.0

    r2 = lambda n: to_fixed(n, 2)  # noqa: E731
    r4 = lambda n: to_fixed(n, 4)  # noqa: E731

    return {
        "currency_code": currency_code,
        "container_capacity_kg": r2(qty_per_fcl),
        "effective_fx_rate": r2(usd_inr),
        "ex_mill_price_inr_per_kg": r2(ex_mill_price),
        "mill_freight_inr_per_kg": 0,
        "packaging_cost_inr_per_kg": 0,
        "yarn_base_cost_inr_per_kg": r2(ex_mill_price),
        "port_expense_inr_per_kg": r2(fob_cost_per_kg),
        "interest_cost_inr_per_kg": r2(interest_amt),
        "gross_landed_cost_inr_per_kg": r2(total_cost),
        "total_incentive_pct": r2(ddb_rodtep_pct),
        "incentive_amount_inr_per_kg": r2(ddb_rodtep),
        "fob_cost_inr_per_kg": r2(fob_cost_per_kg),
        "agent_commission_inr_per_kg": r2(commission_inr),
        "ecgc_amount_inr_per_kg": 0,
        "trader_margin_inr_per_kg": r2(margin_amt),
        "selling_fob_price_inr_per_kg": r2(final_inr),
        "ocean_freight_inr_per_kg": r2(freight_per_kg),
        "cfr_price_inr_per_kg": r2(final_inr),
        "insurance_inr_per_kg": 0,
        "cif_price_inr_per_kg": r2(cif_price_inr),
        "fob_cost_usd_per_kg": r4(div(fob_cost_per_kg, usd_inr)),
        "agent_commission_usd_per_kg": r4(commission_usd),
        "ecgc_amount_usd_per_kg": 0,
        "trader_margin_usd_per_kg": r4(div(margin_amt, usd_inr)),
        "selling_fob_price_usd_per_kg": r4(div(final_inr, usd_inr)),
        "ocean_freight_usd_per_kg": r4(div(selected_freight_usd, qty_per_fcl)),
        "cfr_price_usd_per_kg": r4(cif_price_usd),
        "insurance_usd_per_kg": 0,
        "cif_price_usd_per_kg": r4(cif_price_usd),
        "total_shipment_weight_kg": r2(qty_per_fcl),
        "total_ex_mill_cost_inr": r2(ex_mill_price * qty_per_fcl),
        "total_shipment_cost_inr": r2(total_shipment_cost_inr),
        "total_fob_revenue_usd": r2(div(final_inr, usd_inr) * qty_per_fcl),
        "total_cif_revenue_usd": r2(cif_price_usd * qty_per_fcl),
        "total_net_profit_inr": r2(total_net_profit_inr),
        "total_net_profit_usd": r2(total_net_profit_usd),
        "profit_margin_pct": r2(profit_margin_pct),
        "breakeven_ex_mill_inr_per_kg": r2(final_target),
        "breakeven_cif_usd_per_kg": r4(div(total_cost, usd_inr)),
        "selected_freight_usd": r2(selected_freight_usd),
        "ddb_rodtep": r2(ddb_rodtep),
        "net_ex_mill": r2(net_ex_mill),
        "fob_cost_per_kg": r2(fob_cost_per_kg),
        "padded_rate": r2(padded_rate),
        "freight_per_kg": r2(freight_per_kg),
        "total_cost": r2(total_cost),
        "usd_price": r4(usd_price),
        "eur_price": r4(eur_price) if eur_price is not None else None,
        "eur_unavailable": eur_unavailable,
        "commission_type": commission_type,
        "commission_value": r4(commission_val),
        "commission_inr": r2(commission_inr),
        "commission_usd": r4(commission_usd),
        "effective_commission_pct": r2(effective_comm_pct),
        "target_calc": {
            "target_usd": r4(target_usd),
            "target_inr": r2(target_inr),
            "allowed_ex_mill": r2(allowed_ex_mill),
            "with_buffer": r2(with_buffer),
            "after_interest": r2(after_interest),
            "final_target": r2(final_target),
        },
        "fx_sensitivity": fx_sensitivity,
        "fx": {
            "usd_inr": usd_inr,
            "eur_inr": None if eur_unavailable else eur_inr,
            "rate_date": utc_date_str(),
            "is_fallback": False,
            "padded_usd_inr": padded_rate,
            "eur_unavailable": eur_unavailable,
        },
    }
