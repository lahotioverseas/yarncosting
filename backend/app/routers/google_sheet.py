"""/api/google-sheet/* - live price records for the calculator (backed by the Daily
Pricing Master), adding rows, sheet URL config, preview + sync/publish from Google Sheets."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from ..http import body_dict, read_body, respond
from ..services import auth, pricing_store, sheet_sync
from ..services.jsutil import iso_now, js_number, js_string, js_trim, truthy

router = APIRouter()

ADMIN_ONLY = "Unauthorized: Only Admin users can publish daily prices."
SOURCE = "In-App Daily Pricing Master"


async def _live(refresh: bool) -> dict[str, Any]:
    await sheet_sync.background_merge_if_confirmed(refresh)
    return await run_in_threadpool(pricing_store.get_live_pricing_records)


def _envelope(live: dict[str, Any], kind: str) -> dict[str, Any]:
    base = {
        "fetchedAt": iso_now(),
        "sourceUrl": SOURCE,
        "isFallback": False,
        "isConfirmedForToday": live["status"]["isConfirmedForToday"],
        "dailyPricingStatus": live["status"],
    }
    if kind == "yarn":
        return {"records": live["yarn"]["records"], "uniqueCounts": live["yarn"]["uniqueCounts"], "duplicates": [], **base}
    if kind == "fob":
        return {"records": live["fob"]["records"], "locations": live["fob"]["locations"], **base}
    return {"records": live["freight"]["records"], "destinations": live["freight"]["destinations"], **base}


def _route_pair(path: str, rpc_name: str, kind: str) -> None:
    async def get_records(request: Request):
        try:
            live = await _live(request.query_params.get("refresh") == "true")
            return respond(_envelope(live, kind))
        except Exception as err:
            return respond({"error": str(err)}, 500)

    async def rpc_records():
        try:
            live = await _live(False)
            return respond({"data": _envelope(live, kind), "error": None})
        except Exception as err:
            return respond({"data": None, "error": str(err)}, 500)

    router.add_api_route(path, get_records, methods=["GET"], name=f"sheet_{kind}")
    router.add_api_route(f"/api/rpc/{rpc_name}", rpc_records, methods=["POST"], name=f"rpc_sheet_{kind}")


_route_pair("/api/google-sheet/yarn-products", "get_google_sheet_yarn_products", "yarn")
_route_pair("/api/google-sheet/fob-prices", "get_google_sheet_fob_prices", "fob")
_route_pair("/api/google-sheet/freight-rates", "get_google_sheet_freight_rates", "freight")


def _opt_number(v: Any) -> float | None:
    """`v ? Number(v) : null`"""
    if not truthy(v):
        return None
    n = js_number(v)
    return int(n) if n == n and float(n).is_integer() else n


@router.post("/api/google-sheet/add-destination")
async def add_destination(request: Request):
    body = body_dict(await read_body(request))
    try:
        destination = body.get("destination")
        if not truthy(destination) or not js_trim(js_string(destination)):
            return respond({"success": False, "error": "Destination port name is required"}, 400)
        live = await run_in_threadpool(pricing_store.add_or_update_destination, js_string(destination), _opt_number(body.get("amount")))
        return respond({
            "success": True,
            "message": f'Destination port "{js_string(destination)}" added successfully!',
            "records": live["freight"]["records"],
            "destinations": live["freight"]["destinations"],
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/google-sheet/add-fob-location")
async def add_fob_location(request: Request):
    body = body_dict(await read_body(request))
    try:
        location = body.get("location")
        if not truthy(location) or not js_trim(js_string(location)):
            return respond({"success": False, "error": "FOB location name is required"}, 400)
        live = await run_in_threadpool(pricing_store.add_or_update_fob_location, js_string(location), _opt_number(body.get("price")))
        return respond({
            "success": True,
            "message": f'FOB location "{js_string(location)}" added successfully!',
            "records": live["fob"]["records"],
            "locations": live["fob"]["locations"],
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/google-sheet/add-yarn-product")
async def add_yarn_product(request: Request):
    body = body_dict(await read_body(request))
    try:
        yarn_count, quality = body.get("yarnCount"), body.get("quality")
        if not truthy(yarn_count) or not truthy(quality):
            return respond({"success": False, "error": "Yarn count and quality are required"}, 400)
        live = await run_in_threadpool(
            pricing_store.add_or_update_yarn_product,
            js_string(yarn_count),
            js_string(quality),
            _opt_number(body.get("exMillPrice")),
            body.get("factoryLocation"),
            body.get("category"),
        )
        return respond({
            "success": True,
            "message": f'Yarn product "{js_string(yarn_count)} {js_string(quality)}" added successfully!',
            "records": live["yarn"]["records"],
            "uniqueCounts": live["yarn"]["uniqueCounts"],
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.get("/api/google-sheet/config-urls")
async def get_config_urls():
    return respond({"success": True, "urls": await run_in_threadpool(sheet_sync.get_configured_urls)})


@router.post("/api/google-sheet/config-urls")
async def set_config_urls(request: Request):
    _, denied = _require_admin(request)
    if denied:
        return denied
    body = await read_body(request)
    if isinstance(body, dict) and body:
        allowed = {k: v for k, v in body.items() if k in sheet_sync.DEFAULT_SHEET_URLS and isinstance(v, str)}
        return respond({"success": True, "urls": await run_in_threadpool(sheet_sync.update_configured_urls, allowed)})
    return respond({"success": True, "urls": await run_in_threadpool(sheet_sync.get_configured_urls)})


def _require_admin(request: Request):
    admin = auth.admin_from_header(request.headers.get("authorization"))
    if admin is None:
        return None, respond({"success": False, "error": ADMIN_ONLY}, 403)
    return admin, None


@router.post("/api/google-sheet/preview-sync")
async def preview_sync(request: Request):
    _, denied = _require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        return respond(await sheet_sync.preview_sync(body))
    except (sheet_sync.SheetReturnedHtmlError, sheet_sync.InvalidSheetUrlError) as err:
        return respond({"success": False, "error": str(err)}, 400)
    except Exception as err:
        return respond({"success": False, "error": str(err) or "Failed to preview Google Sheet sync"}, 500)


@router.post("/api/google-sheet/sync-from-sheets")
async def sync_from_sheets(request: Request):
    """"Publish Prices": pull the edited Google Sheet and make it today's active prices (unlocks)."""
    admin, denied = _require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        result = await sheet_sync.sync_and_publish(body, body.get("confirmedBy") or admin.get("name") or "Admin")
        return respond({
            "success": True,
            "message": "Successfully fetched live Google Sheets data and updated Daily Pricing Master!",
            "status": result["status"],
            "sheets": result["sheets"],
        })
    except (sheet_sync.SheetReturnedHtmlError, sheet_sync.InvalidSheetUrlError) as err:
        return respond({"success": False, "error": str(err)}, 400)
    except Exception as err:
        return respond({"success": False, "error": str(err) or "Failed to sync from Google Sheets"}, 500)


@router.api_route("/api/google-sheet/publish-webhook", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def publish_webhook():
    return respond({
        "success": False,
        "error": "Webhook publishing is disabled. Prices can only be unlocked via explicit Admin publish actions in the UI.",
    }, 403)
