"""Request/response helpers that keep the API contract identical to the old
Express server (JSON bodies, NaN -> null like JSON.stringify, 400 on bad JSON)."""
from __future__ import annotations

import json
import math
from typing import Any
from urllib.parse import parse_qs

from fastapi import Request
from fastapi.responses import JSONResponse


class MalformedJSONError(Exception):
    pass


def _sanitize(obj: Any) -> Any:
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (str, int, bool)) or obj is None:
        return obj
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if type(obj).__name__ == "_Undefined":
        return None
    return str(obj)  # e.g. bson ObjectId


class JSResponse(JSONResponse):
    """JSONResponse that serialises NaN/Infinity as null (JS JSON.stringify behaviour)."""

    def render(self, content: Any) -> bytes:
        return json.dumps(_sanitize(content), ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def respond(content: Any, status_code: int = 200) -> JSResponse:
    return JSResponse(content=content, status_code=status_code)


async def read_body(request: Request) -> Any:
    """Equivalent of Express json()+urlencoded() body parsing. Missing body -> {}."""
    raw = await request.body()
    if not raw or not raw.strip():
        return {}
    ctype = (request.headers.get("content-type") or "").lower()
    if "application/x-www-form-urlencoded" in ctype:
        parsed = parse_qs(raw.decode("utf-8", errors="replace"), keep_blank_values=True)
        return {k: (v[0] if len(v) == 1 else v) for k, v in parsed.items()}
    if "json" in ctype or not ctype:
        try:
            return json.loads(raw)
        except ValueError as err:
            raise MalformedJSONError() from err
    return {}


async def read_params(request: Request) -> dict[str, Any]:
    """`req.method === 'GET' ? req.query : req.body` used by the app.all() RPC routes."""
    if request.method == "GET":
        return dict(request.query_params)
    body = await read_body(request)
    return body if isinstance(body, dict) else {}


def body_dict(body: Any) -> dict[str, Any]:
    return body if isinstance(body, dict) else {}
