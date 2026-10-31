"""/api/zoho/* - accounts lookup, deal creation (blocked while prices are locked), deal info."""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from ..http import body_dict, read_body, respond
from ..services import pricing_store, zoho
from ..services.jsutil import format_en_us_2, iso_now, js_or, js_parse_float, js_round, js_string, nullish, to_fixed
from .rpc import add_saved_quote, new_saved_quote_id, random_quote_number

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/zoho")

_TIMEOUT = httpx.Timeout(30.0)
_NON_NUMERIC = re.compile(r"[^0-9.]")


@router.get("/accounts-and-agents")
async def accounts_and_agents(request: Request):
    try:
        return respond(await zoho.get_accounts_and_agents(request.query_params.get("refresh") == "true"))
    except Exception as err:
        return respond({"items": [], "is_connected": False, "error": str(err)}, 500)


def _json_or_empty(res: httpx.Response) -> Any:
    try:
        return res.json()
    except Exception:
        return {}


def _deal_id(result: Any) -> str | None:
    try:
        return result["data"][0]["details"]["id"]
    except Exception:
        return None


@router.post("/create-deal")
async def create_deal(request: Request):
    try:
        status = await run_in_threadpool(pricing_store.get_daily_pricing_status)
        if not status["isConfirmedForToday"]:
            return respond({
                "success": False,
                "error": "Prices are not updated for today. Admin must update and publish today's prices in the Daily Pricing Master before creating deals.",
            }, 400)

        body = body_dict(await read_body(request))
        account_name = body.get("account_name")
        contact_name = body.get("contact_name")
        deal_name = body.get("deal_name")
        amount = body.get("amount")
        products = body.get("products")
        text_quote = body.get("text_quote")
        destination_port = body.get("destination_port")
        payment_term = body.get("payment_term")
        packing = body.get("packing")
        commission = body.get("commission")
        terms = body.get("terms")
        currency = body.get("currency")
        owner_name = body.get("owner_name")
        owner_email = body.get("owner_email")

        tok = await zoho.get_access_token()
        access_token = tok.get("token")
        api_domain = tok.get("apiDomain") or zoho.default_api_domain()

        zoho_deal_id = None
        zoho_connected = False
        owner_assigned: dict[str, Any] | None = None
        zoho_result: Any = None
        zoho_task_id = None
        follow_up_task = None
        deal_stage = body.get("stage") or "Quote sent"

        closing_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

        deal_currency = (currency or "USD").upper()
        deal_packing = packing or "Pallet Packing"
        deal_commission = commission or None
        deal_terms = terms or (
            f"CNF {destination_port}, {payment_term}" if destination_port and payment_term
            else (f"CNF {destination_port}" if destination_port else None)
        )

        clean_account = (account_name or "").strip()
        derived_contact = (contact_name or "").strip()
        m = re.match(r"^(.*?)\s*\((.*?)\)\Z", clean_account)
        if m:
            clean_account = m.group(1).strip()
            if not derived_contact:
                derived_contact = m.group(2).strip()

        subform_items: list[dict[str, Any]] = []
        resolved_product_ids: list[str] = []
        computed_total = 0.0
        product_list = products if isinstance(products, list) and products else []

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            headers = {"Authorization": f"Zoho-oauthtoken {access_token}", "Content-Type": "application/json"}

            if access_token and product_list:
                for idx, p in enumerate(product_list):
                    p = p if isinstance(p, dict) else {}
                    resolved = await zoho.resolve_or_create_product(client, p, access_token, api_domain)
                    if resolved and resolved.get("id"):
                        resolved_product_ids.append(resolved["id"])

                    raw_qty = _NON_NUMERIC.sub("", js_string(nullish(p.get("quantity"), "")))
                    parsed_qty = js_round(js_or(js_parse_float(raw_qty), 21000))
                    qty = int(parsed_qty) if float(parsed_qty).is_integer() and parsed_qty > 0 else 21000

                    raw_price = _NON_NUMERIC.sub("", js_string(nullish(p.get("usdPrice"), nullish(p.get("price"), ""))))
                    unit_price = js_parse_float(raw_price)
                    unit_price = unit_price if unit_price == unit_price and unit_price else 0.0
                    line_amount = to_fixed(unit_price * qty, 2)
                    computed_total += line_amount

                    row: dict[str, Any] = {
                        "Currency1": deal_currency,
                        "Quantity": qty,
                        "Unit": "kg",
                        "Price1": to_fixed(unit_price, 4),
                        "Amount": line_amount,
                        "LinkingModule5_Serial_Number": str(idx + 1),
                    }
                    if resolved and resolved.get("id"):
                        row["Product_Name"] = {"id": resolved["id"], "name": resolved["name"]}
                    subform_items.append(row)

            try:
                amount_num = float(amount) if amount not in (None, "") else 0.0
            except (TypeError, ValueError):
                amount_num = 0.0
            final_amount = to_fixed(computed_total, 2) if computed_total > 0 else (amount_num if amount_num == amount_num else 0.0)

            full_description = text_quote or f"Yarn Costing Quote for {clean_account}"
            if "Packing:" not in full_description and deal_packing:
                full_description += f"\nPacking: {deal_packing}"
            if "Commission:" not in full_description and deal_commission and deal_commission != "Nil":
                full_description += f"\nCommission: {deal_commission}"
            if deal_terms and deal_terms not in full_description:
                full_description += f"\nTerms: {deal_terms}"
            full_description += (
                f"\nCurrency: {deal_currency}\nEstimated Deal Amount: {deal_currency} {format_en_us_2(final_amount)}"
                f"\nValid Till / Closing Date: {closing_date}"
            )
            if derived_contact:
                full_description += f"\nContact Person: {derived_contact}"
            if owner_name:
                full_description += f"\nSales Owner: {owner_name} ({owner_email or ''})"

            matched_owner = None
            resolved_contact_id = None
            cached_items = (zoho.cached_accounts or {}).get("items") or []

            if access_token and clean_account:
                matched_owner = zoho.resolve_zoho_user(owner_email, owner_name)
                low = clean_account.lower().strip()
                matched_account = next((i for i in cached_items if i.get("name") and i["name"].lower().strip() == low), None)
                if matched_account is None:
                    matched_account = next(
                        (i for i in cached_items if i.get("name") and (low in i["name"].lower() or i["name"].lower() in clean_account.lower())),
                        None,
                    )

                single_deal: dict[str, Any] = {
                    "Deal_Name": deal_name or f"Yarn Quote - {clean_account}",
                    "Stage": deal_stage,
                    "Amount": final_amount,
                    "Currency": deal_currency,
                    "Closing_Date": closing_date,
                    "Packing": deal_packing,
                    "Commission_if_any": deal_commission,
                    "Terms1": deal_terms,
                    "Description": full_description,
                }
                if matched_account and matched_account.get("id") and matched_account.get("type") == "Account":
                    single_deal["Account_Name"] = {"id": matched_account["id"], "name": matched_account["name"]}
                else:
                    single_deal["Account_Name"] = {"name": clean_account}

                if matched_account and matched_account.get("contact_id"):
                    resolved_contact_id = matched_account["contact_id"]
                elif derived_contact:
                    mc = next(
                        (i for i in cached_items if i.get("contact_name") and derived_contact.lower() in i["contact_name"].lower()),
                        None,
                    )
                    if mc and mc.get("contact_id"):
                        resolved_contact_id = mc["contact_id"]
                if resolved_contact_id:
                    single_deal["Contact_Name"] = {"id": resolved_contact_id}
                if subform_items:
                    single_deal["Subform_1"] = subform_items

                if matched_owner and matched_owner.get("id"):
                    single_deal["Owner"] = {"id": matched_owner["id"]}
                    owner_assigned = matched_owner
                else:
                    single_deal["Owner"] = {"id": zoho.DEFAULT_OWNER_ID}
                    owner_assigned = {"id": zoho.DEFAULT_OWNER_ID, "name": f"{owner_name or 'Trader'} (via Saurabh Lahoti)", "email": "saurabh@lahotioverseas.com"}

                deals_url = f"https://{api_domain}/crm/v2/Deals"
                # Attempt 1: matched owner with Subform_1
                zoho_result = _json_or_empty(await client.post(deals_url, headers=headers, json={"data": [single_deal]}))
                log.info("Zoho Deal creation result (Attempt 1): %s", json.dumps(zoho_result)[:1000])
                zoho_deal_id = _deal_id(zoho_result)
                if zoho_deal_id:
                    zoho_connected = True
                else:
                    # Attempt 2: fallback admin owner
                    single_deal["Owner"] = {"id": zoho.DEFAULT_OWNER_ID}
                    single_deal["Description"] = f"[Created by: {owner_name or 'User'} ({owner_email or ''})]\n\n{single_deal['Description']}"
                    retry = _json_or_empty(await client.post(deals_url, headers=headers, json={"data": [single_deal]}))
                    log.info("Zoho Deal creation result (Attempt 2): %s", json.dumps(retry)[:1000])
                    if _deal_id(retry):
                        zoho_deal_id = _deal_id(retry)
                        zoho_connected = True
                        owner_assigned = {"id": zoho.DEFAULT_OWNER_ID, "name": f"{owner_name or 'Trader'} (Admin: Saurabh Lahoti)", "email": "saurabh@lahotioverseas.com"}
                        zoho_result = retry
                    else:
                        # Attempt 3: without Subform_1 / Owner, then attach the subform
                        stripped = {k: v for k, v in single_deal.items() if k not in ("Subform_1", "Owner")}
                        fallback = _json_or_empty(await client.post(deals_url, headers=headers, json={"data": [stripped]}))
                        log.info("Zoho Deal creation result (Attempt 3): %s", json.dumps(fallback)[:1000])
                        if _deal_id(fallback):
                            zoho_deal_id = _deal_id(fallback)
                            zoho_connected = True
                            owner_assigned = {"name": owner_name or "Default Owner", "email": owner_email or ""}
                            zoho_result = fallback
                            if subform_items:
                                try:
                                    await client.put(deals_url, headers=headers, json={"data": [{"id": zoho_deal_id, "Subform_1": subform_items}]})
                                except Exception as e:
                                    log.warning("Failed attaching Subform_1 via PUT: %s", e)

                if zoho_deal_id and zoho_connected and resolved_product_ids:
                    try:
                        link = await client.put(
                            f"https://{api_domain}/crm/v2/Deals/{zoho_deal_id}/Products",
                            headers=headers,
                            json={"data": [{"id": pid} for pid in resolved_product_ids]},
                        )
                        log.info("Zoho Deal Products related list link result: %s", link.text[:500])
                    except Exception as e:
                        log.warning("Failed linking products to Deal related list: %s", e)

                if zoho_deal_id and zoho_connected:
                    try:
                        task_owner_id = (owner_assigned or {}).get("id") or (matched_owner or {}).get("id") or zoho.DEFAULT_OWNER_ID
                        subject = f"Follow up for quote feedback - {clean_account}"
                        quoted = ", ".join(
                            (p.get("yarn_description") or f"{js_string(p.get('yarnCount'))} {js_string(p.get('quality'))}")
                            for p in product_list if isinstance(p, dict)
                        )
                        description = (
                            f"Follow up with {clean_account} for feedback on the yarn quotation.\n\n"
                            f"Deal: {deal_name or f'Yarn Quote - {clean_account}'}\nQuoted Products: {quoted}\n"
                            f"Total Amount: {deal_currency} {format_en_us_2(final_amount)}\nTerms: {js_string(deal_terms)}\n"
                            f"Packing: {deal_packing}\nCommission: {js_string(deal_commission)}\nClosing Date: {closing_date}"
                        )
                        task = {
                            "Subject": subject,
                            "What_Id": {"id": zoho_deal_id},
                            "$se_module": "Deals",
                            "Owner": {"id": task_owner_id},
                            "Due_Date": closing_date,
                            "Status": "Not Started",
                            "Priority": "High",
                            "Send_Notification_Email": True,
                            "Description": description,
                        }
                        if resolved_contact_id:
                            task["Who_Id"] = {"id": resolved_contact_id}
                        task_result = _json_or_empty(await client.post(f"https://{api_domain}/crm/v2/Tasks", headers=headers, json={"data": [task]}))
                        log.info("Zoho Follow-up Task creation result: %s", json.dumps(task_result)[:1000])
                        if _deal_id(task_result):
                            zoho_task_id = _deal_id(task_result)
                            follow_up_task = {
                                "id": zoho_task_id,
                                "subject": subject,
                                "due_date": closing_date,
                                "owner": (owner_assigned or {}).get("name") or owner_name or "Sales Person",
                                "status": "Not Started",
                                "priority": "High",
                            }
                    except Exception as e:
                        log.error("Error creating follow-up task in Zoho CRM: %s", e)

        # Record the quote locally
        quote_number = random_quote_number()
        first = product_list[0] if product_list and isinstance(product_list[0], dict) else None
        await run_in_threadpool(add_saved_quote, {
            "id": new_saved_quote_id(),
            "quote_number": quote_number,
            "customer_name": clean_account or "Valued Customer",
            "destination_country": destination_port or "Chittagong",
            "yarn_count_name": (first.get("yarn_description") or first.get("yarnCount")) if first else "Multi-Product Quote",
            "container_type": f"{deal_packing} (FCL)",
            "cif_price_usd_per_kg": (first or {}).get("usdPrice") or ((final_amount / 20000) if final_amount else 0),
            "total_net_profit_usd": 0,
            "created_at": iso_now(),
            "inputs": {
                "customer_name": clean_account,
                "products": product_list,
                "text_quote": full_description,
                "payment_term": payment_term,
                "destination_port": destination_port,
                "packing": deal_packing,
                "commission": deal_commission,
                "terms": deal_terms,
                "currency": deal_currency,
                "closing_date": closing_date,
            },
            "results": {"text_quote": full_description},
        })

        crm_web = "crm.zoho.com" if "zohoapis.com" in api_domain else "crm.zoho.in"
        err_msg = None
        if not zoho_connected:
            try:
                err_msg = zoho_result["data"][0]["message"]
            except Exception:
                err_msg = (zoho_result or {}).get("message") if isinstance(zoho_result, dict) else None

        return respond({
            "success": True,
            "quote_number": quote_number,
            "zoho_deal_id": zoho_deal_id or f"sim_deal_{int(datetime.now().timestamp() * 1000)}",
            "zoho_deal_url": f"https://{crm_web}/crm/tab/Potentials/{zoho_deal_id}" if zoho_deal_id else None,
            "zoho_deal_url_com": f"https://crm.zoho.com/crm/tab/Potentials/{zoho_deal_id}" if zoho_deal_id else None,
            "zoho_deal_url_in": f"https://crm.zoho.in/crm/tab/Potentials/{zoho_deal_id}" if zoho_deal_id else None,
            "zoho_task_id": zoho_task_id,
            "follow_up_task": follow_up_task,
            "zoho_connected": zoho_connected,
            "zoho_raw_result": zoho_result,
            "owner_assigned": (owner_assigned or {}).get("name") or owner_name or None,
            "deal_details": {
                "id": zoho_deal_id,
                "name": deal_name or f"Yarn Quote - {clean_account}",
                "stage": deal_stage,
                "amount": final_amount,
                "currency": deal_currency,
                "packing": deal_packing,
                "commission": deal_commission or "Nil",
                "terms": deal_terms,
                "closing_date": closing_date,
                "task": follow_up_task,
                "products": [
                    {
                        "name": (item.get("Product_Name") or {}).get("name")
                        or (product_list[i].get("yarn_description") if i < len(product_list) and isinstance(product_list[i], dict) else None)
                        or (product_list[i].get("yarnCount") if i < len(product_list) and isinstance(product_list[i], dict) else None),
                        "price": item["Price1"],
                        "quantity": item["Quantity"],
                        "unit": item["Unit"],
                        "amount": item["Amount"],
                        "currency": item["Currency1"],
                    }
                    for i, item in enumerate(subform_items)
                ],
            },
            "message": (
                f"Deal created in Zoho CRM (Stage: Quote sent) and follow-up task scheduled for "
                f"{(owner_assigned or {}).get('name') or owner_name} (Deal ID: {zoho_deal_id})"
                if zoho_connected
                else f"Quote recorded! (Zoho CRM Deal created for {clean_account} by {owner_name or 'User'})"
            ),
            "error": None if zoho_connected else err_msg,
        })
    except Exception as err:
        log.exception("create-deal failed")
        return respond({"success": False, "error": str(err)}, 500)


@router.get("/deal-info/{deal_id}")
async def deal_info(deal_id: str):
    try:
        tok = await zoho.get_access_token()
        if not tok.get("token"):
            return respond({"error": "Zoho not connected"}, 401)
        api_domain = tok.get("apiDomain") or zoho.default_api_domain()
        headers = {"Authorization": f"Zoho-oauthtoken {tok['token']}"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            deal_res = await client.get(f"https://{api_domain}/crm/v2/Deals/{deal_id}", headers=headers)
            org_res = await client.get(f"https://{api_domain}/crm/v2/org", headers=headers)
        return respond({"deal": deal_res.json(), "org": org_res.json()})
    except Exception as err:
        return respond({"error": str(err)}, 500)


@router.get("/recent-deals")
async def recent_deals():
    try:
        tok = await zoho.get_access_token()
        if not tok.get("token"):
            return respond({"error": "Zoho not connected"}, 401)
        api_domain = tok.get("apiDomain") or zoho.default_api_domain()
        crm_web = "crm.zoho.com" if "zohoapis.com" in api_domain else "crm.zoho.in"
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.get(
                f"https://{api_domain}/crm/v2/Deals?sort_order=desc&sort_by=Created_Time&per_page=15",
                headers={"Authorization": f"Zoho-oauthtoken {tok['token']}"},
            )
        data = res.json()
        if isinstance(data, dict) and data.get("data"):
            data["data"] = [
                {
                    **d,
                    "deal_url": f"https://{crm_web}/crm/tab/Potentials/{d.get('id')}",
                    "deal_url_in": f"https://crm.zoho.in/crm/tab/Potentials/{d.get('id')}",
                    "deal_url_com": f"https://crm.zoho.com/crm/tab/Potentials/{d.get('id')}",
                }
                for d in data["data"]
            ]
        return respond(data)
    except Exception as err:
        return respond({"error": str(err)}, 500)
