"""/api/auth/*, /api/employee-sheets/*, /api/mongo/*"""
from __future__ import annotations

import threading
from typing import Any

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from ..http import body_dict, read_body, respond
from ..services import auth, mongo_manager, persistence
from ..services.jsutil import iso_now, now_ms

router = APIRouter()

# ---------------------------------------------------------------- auth


@router.get("/api/auth/users")
async def auth_users():
    return respond({"users": [auth.public_user(u) for u in auth.SYSTEM_USERS], "error": None})


@router.post("/api/auth/login")
async def auth_login(request: Request):
    body = body_dict(await read_body(request))
    email, password = body.get("email"), body.get("password")
    if not email or not password:
        return respond({"success": False, "error": "Email and password are required."}, 400)
    result = auth.authenticate_user(str(email), str(password))
    if not result.get("success") or not result.get("user"):
        return respond({"success": False, "error": result.get("error") or "Invalid credentials"}, 401)
    user = auth.public_user(result["user"])
    token = auth.sign_auth_token({
        "uid": user["id"],
        "role": user["role"],
        "name": user["name"],
        "exp": now_ms() + 7 * 24 * 60 * 60 * 1000,
    })
    return respond({"success": True, "user": user, "token": token})


# ---------------------------------------------------------------- employee sheets

_emp_lock = threading.Lock()


@router.get("/api/employee-sheets")
async def employee_sheets():
    try:
        data = await run_in_threadpool(persistence.get_setting, "employee_sheets", None)
        return respond({"success": True, "employeeSheets": data or None})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


def _save_employee_sheet(emp_id: str, patch: dict[str, Any]) -> list[dict[str, Any]]:
    with _emp_lock:
        current = persistence.get_setting("employee_sheets", None)
        current = current if isinstance(current, list) else []
        idx = next((i for i, item in enumerate(current) if item.get("empId") == emp_id), -1)
        if idx >= 0:
            current[idx] = {**current[idx], **patch, "updatedAt": iso_now()}
        else:
            current.append({"empId": emp_id, **patch, "updatedAt": iso_now()})
        persistence.set_setting("employee_sheets", current)
        return current


@router.post("/api/employee-sheets/save")
async def employee_sheets_save(request: Request):
    body = body_dict(await read_body(request))
    try:
        emp_id, patch = body.get("empId"), body.get("patch")
        if not emp_id:
            return respond({"success": False, "error": "empId is required"}, 400)
        current = await run_in_threadpool(_save_employee_sheet, emp_id, patch if isinstance(patch, dict) else {})
        return respond({"success": True, "message": f"Saved Google Sheet settings for {emp_id}", "employeeSheets": current})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


# ---------------------------------------------------------------- mongo (Admin only)


def _deny_non_admin(request: Request):
    if auth.admin_from_header(request.headers.get("authorization")) is None:
        return respond({"success": False, "error": "Unauthorized: Only Admin users can manage the database."}, 403)
    return None


@router.get("/api/mongo/status")
async def mongo_status(request: Request):
    if (denied := _deny_non_admin(request)) is not None:
        return denied
    try:
        conn = await run_in_threadpool(mongo_manager.check_mongo_connection)
        return respond({
            "success": True,
            "data": {
                "connection": conn,
                "dbName": mongo_manager.DB_NAME,
                "expectedTables": [
                    {"name": t["name"], "description": t["description"], "indexesCount": len(t["indexes"])}
                    for t in mongo_manager.DASHBOARD_TABLE_DEFINITIONS
                ],
            },
        })
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/mongo/test")
async def mongo_test(request: Request):
    if (denied := _deny_non_admin(request)) is not None:
        return denied
    body = body_dict(await read_body(request))
    try:
        conn = await run_in_threadpool(mongo_manager.check_mongo_connection, body.get("uri"))
        return respond({"success": True, "data": conn})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/mongo/init")
async def mongo_init(request: Request):
    if (denied := _deny_non_admin(request)) is not None:
        return denied
    body = body_dict(await read_body(request))
    try:
        result = await run_in_threadpool(mongo_manager.create_all_mongo_tables, body.get("uri"))
        return respond({"success": result["success"], "data": result})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/mongo/set-uri")
async def mongo_set_uri(request: Request):
    if (denied := _deny_non_admin(request)) is not None:
        return denied
    body = body_dict(await read_body(request))
    try:
        uri = body.get("uri")
        if not uri:
            return respond({"success": False, "error": "URI is required"}, 400)
        return respond({"success": True, "activeUri": mongo_manager.set_active_mongo_uri(str(uri))})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)


@router.post("/api/mongo/push-all-data")
async def mongo_push_all(request: Request):
    if (denied := _deny_non_admin(request)) is not None:
        return denied
    body = body_dict(await read_body(request))
    try:
        result = await run_in_threadpool(mongo_manager.push_all_application_data, body)
        return respond({"success": result["success"], "data": result})
    except Exception as err:
        return respond({"success": False, "error": str(err)}, 500)
