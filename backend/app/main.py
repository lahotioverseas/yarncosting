"""FastAPI application: mounts all /api routers and (in production) serves the
built React app from frontend/dist with SPA fallback."""
from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from . import config
from .http import MalformedJSONError, respond
from .routers import daily_pricing, google_sheet, misc, rpc, zoho
from .services import auth, db, fx, ist_time, mongo_manager, pricing_store
from .services import zoho as zoho_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("yarn_costing")


def _boot_tasks() -> None:
    try:
        fx.refresh_exchange_rates()  # live FX on boot
    except Exception as e:
        log.warning("Initial live FX fetch warning: %s", e)
    pricing_store.initialize_mongo_collections_and_seed()


async def _midnight_watcher() -> None:
    """Log the daily 12:00 AM IST lock. The lock itself is date-based (see pricing_store),
    so prices are locked for every employee even if this task is not running."""
    while True:
        await asyncio.sleep(ist_time.seconds_until_midnight_ist() + 1)
        log.info("12:00 AM IST - prices locked for %s until an Admin confirms them.", ist_time.today_ist())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if config.IS_VERCEL:
        # Serverless: no long-running background work. FX is refreshed on demand (fx.ensure_fresh)
        # and the daily lock is purely date-based, so nothing has to run at midnight.
        yield
        return
    threading.Thread(target=_boot_tasks, name="boot-tasks", daemon=True).start()
    watcher = asyncio.create_task(_midnight_watcher())
    try:
        yield
    finally:
        watcher.cancel()


app = FastAPI(title="Yarn Trading Costing API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.exception_handler(MalformedJSONError)
async def malformed_json_handler(_request: Request, _exc: MalformedJSONError):
    return respond({"success": False, "error": "Malformed JSON payload."}, 400)


@app.get("/api/health")
async def health():
    """Deployment check: open /api/health after deploying. Shows no secrets."""
    mongo_connected = (await run_in_threadpool(db.get_db)) is not None
    problems = []
    if not db.mongo_configured():
        problems.append("MONGODB_URI is not set - prices are only stored in temporary files")
    elif not mongo_connected:
        problems.append("MongoDB is not reachable - check MONGODB_URI and Atlas Network Access (allow 0.0.0.0/0 for Vercel)")
    if config.IS_VERCEL and auth.SECRET_SOURCE not in ("AUTH_SECRET", "derived-from-MONGODB_URI"):
        problems.append("AUTH_SECRET is not set - logins will randomly fail on Vercel")
    if not zoho_service.zoho_configured():
        problems.append("Zoho keys not set - deals are recorded locally only")
    return respond({
        "ok": not problems or problems == ["Zoho keys not set - deals are recorded locally only"],
        "vercel": config.IS_VERCEL,
        "mongo": {"configured": db.mongo_configured(), "connected": mongo_connected, "database": mongo_manager.DB_NAME},
        "authSecret": auth.SECRET_SOURCE,
        "zohoConfigured": zoho_service.zoho_configured(),
        "todayIST": ist_time.today_ist(),
        "problems": problems,
    })


app.include_router(rpc.router)
app.include_router(google_sheet.router)
app.include_router(daily_pricing.router)
app.include_router(misc.router)
app.include_router(zoho.router)


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"], include_in_schema=False)
async def api_not_found(request: Request, rest: str):
    """Unknown /api routes always answer JSON (never the SPA index.html)."""
    url = request.url.path + (f"?{request.url.query}" if request.url.query else "")
    return respond({"data": None, "error": f"API route not found: {request.method} {url}"}, 404)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    dist = config.FRONTEND_DIST
    index = dist / "index.html"
    if not index.exists():
        return respond({
            "success": False,
            "error": "Frontend is not built. Run the Vite dev server (cd frontend && npm run dev) or build it (npm run build).",
        }, 404)
    candidate = (dist / full_path).resolve()
    if full_path and candidate.is_file() and dist in candidate.parents:
        return FileResponse(candidate)
    return FileResponse(index)
