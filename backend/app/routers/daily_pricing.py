"""/api/daily-pricing/* - daily price lock status and the admin unlock actions."""
from __future__ import annotations

import logging
from urllib.parse import quote

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse

from ..http import body_dict, read_body, respond
from ..services import auth, pricing_store, sheet_sync
from ..services.jsutil import now_ms

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/daily-pricing")

ADMIN_ONLY = "Unauthorized: Only Admin users can publish daily prices."


def require_admin(request: Request):
    """Returns the admin token payload, or a 403 response when the caller is not a logged-in admin."""
    admin = auth.admin_from_header(request.headers.get("authorization"))
    if admin is None:
        return None, respond({"success": False, "error": ADMIN_ONLY}, 403)
    return admin, None


@router.get("")
async def get_daily_pricing():
    try:
        store = await run_in_threadpool(pricing_store.get_daily_pricing_store)
        return respond({"success": True, "status": pricing_store.status_from_store(store), "sheets": store["sheets"]})
    except pricing_store.PricingStoreUnavailableError:
        return respond({"success": False, "error": "Pricing store temporarily unavailable"}, 503)
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/keep-previous")
async def keep_previous(request: Request):
    """Option 1 - keep yesterday's prices: unlock immediately for everyone."""
    admin, denied = require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        confirmed_by = body.get("confirmedBy") or admin.get("name") or "Admin"
        status = await run_in_threadpool(pricing_store.confirm_previous_prices_for_today, confirmed_by)
        store = await run_in_threadpool(pricing_store.get_daily_pricing_store)
        return respond({
            "success": True,
            "status": status,
            "sheets": store["sheets"],
            "message": "Yesterday's prices confirmed and active for today!",
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/start-edit")
async def start_edit(request: Request):
    """Option 2 - admin is opening the Google Sheet. Prices stay locked; every admin screen now
    shows "Publish Prices" until the edited sheet is published (or previous prices are kept)."""
    admin, denied = require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        started_by = body.get("startedBy") or admin.get("name") or "Admin"
        status = await run_in_threadpool(pricing_store.start_sheet_edit, started_by)
        return respond({"success": True, "status": status, "message": "Editing in Google Sheet. Click Publish Prices when done."})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/save-and-publish")
async def save_and_publish(request: Request):
    admin, denied = require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        sheets = body.get("sheets")
        if not sheets or not isinstance(sheets, dict) or not sheets.get("yarn"):
            return respond({"success": False, "error": "Invalid sheets payload"}, 400)
        result = await run_in_threadpool(
            pricing_store.save_and_publish_daily_prices, sheets, body.get("confirmedBy") or admin.get("name") or "Admin"
        )
        return respond({
            "success": True,
            "status": result["status"],
            "sheets": result["sheets"],
            "message": "Today's prices updated, confirmed, and published across system!",
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.api_route("/confirm-from-sheet", methods=["GET", "POST"])
async def confirm_from_sheet(request: Request):
    """The "Return to dashboard" link/button placed inside the Google Sheet.

    * Clicked in a browser (GET): opens the costing app, which shows the admin the
      "Publish Prices" button. Nothing is unlocked by the link itself, so prices stay
      locked until an admin publishes.
    * Called by Apps Script / API with an admin token: pulls the edited sheet and
      publishes it straight away (same as clicking Publish Prices)."""
    employee = (request.query_params.get("employee") or "").strip()
    body = {}
    if request.method != "GET":
        try:
            body = body_dict(await read_body(request))
        except Exception:
            body = {}
    employee = employee or str(body.get("employee") or "").strip()

    accept = request.headers.get("accept") or ""
    is_browser_nav = request.method == "GET" and ("text/html" in accept or "application/json" not in accept)
    if is_browser_nav:
        return RedirectResponse(
            f"/?action=return-from-sheet&employee={quote(employee or 'all', safe='')}&at={now_ms()}", status_code=302
        )

    admin = auth.admin_from_header(request.headers.get("authorization"))
    if admin is None:
        return respond({
            "success": False,
            "requiresPublish": True,
            "error": "Open the Costing Dashboard and click 'Publish Prices' (Admin) to unlock today's prices.",
            "dashboardUrl": "/?action=return-from-sheet",
        }, 403)

    confirmed_by = str(
        request.query_params.get("confirmedBy")
        or body.get("confirmedBy")
        or (f"Employee ({employee.upper()})" if employee else admin.get("name") or "Google Sheet Admin")
    )
    try:
        result = await sheet_sync.sync_and_publish(body, confirmed_by)
        log.info("Prices published & unlocked via Google Sheet by %s %s", confirmed_by, f"[{employee}]" if employee else "")
        return respond({
            "success": True,
            "message": f"Today's prices successfully confirmed & unlocked for all employees! (Triggered by {confirmed_by})",
            "status": result["status"],
            "employee": employee or "all",
            "sheets": result["sheets"],
            "dashboardUrl": "/?action=confirmed-from-sheet&status=unlocked",
        })
    except (sheet_sync.SheetReturnedHtmlError, sheet_sync.InvalidSheetUrlError) as err:
        return respond({"success": False, "error": str(err)}, 400)
    except Exception as err:
        log.error("Error in confirm-from-sheet: %s", err)
        return respond({"success": False, "error": str(err)}, 500)


@router.get("/history")
async def history(request: Request):
    _, denied = require_admin(request)
    if denied:
        return denied
    try:
        data = await run_in_threadpool(pricing_store.get_daily_pricing_history)
        return respond({"success": True, "history": data})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/restore")
async def restore(request: Request):
    _, denied = require_admin(request)
    if denied:
        return denied
    body = body_dict(await read_body(request))
    try:
        entry_id = body.get("id")
        if not entry_id:
            return respond({"success": False, "error": "History ID is required"}, 400)
        entry = await run_in_threadpool(pricing_store.get_daily_pricing_history_entry, str(entry_id))
        return respond({
            "success": True,
            "draftSheets": entry.get("sheets"),
            "confirmedDate": entry.get("confirmedDate"),
            "confirmedBy": entry.get("confirmedBy"),
            "confirmationType": entry.get("confirmationType"),
            "message": f"History entry {entry_id} loaded as draft into editor. Click Publish to make it active.",
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)
