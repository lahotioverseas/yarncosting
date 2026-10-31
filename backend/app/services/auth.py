"""Login against the system user list and signed bearer tokens.

Tokens are ``base64url(json payload) + "." + HMAC-SHA256 signature``. The
signature means only the server can mint an admin token, so the 12:00 AM price
lock can only be lifted by a logged-in admin (the old tokens were plain base64
and anyone could forge one)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from typing import Any

from .. import config
from .jsutil import now_ms
from .seeds import system_users

SYSTEM_USERS: list[dict[str, Any]] = system_users()


def _load_secret() -> tuple[bytes, str]:
    """Returns (secret, source). Every server instance must use the SAME secret, otherwise a
    login made on one Vercel instance is rejected by the next one."""
    env = os.environ.get("AUTH_SECRET")
    if env:
        return env.encode("utf-8"), "AUTH_SECRET"
    mongo_uri = os.environ.get("MONGODB_URI")
    if config.IS_VERCEL and mongo_uri:
        # stable across instances and as private as the database password
        return hashlib.sha256(f"yarn-costing-auth:{mongo_uri}".encode("utf-8")).hexdigest().encode("utf-8"), "derived-from-MONGODB_URI"
    path = config.DATA_DIR / "auth_secret.key"
    try:
        if path.exists():
            return path.read_text(encoding="utf-8").strip().encode("utf-8"), "local-file"
        value = secrets.token_hex(32)
        path.write_text(value, encoding="utf-8")
        return value.encode("utf-8"), "local-file"
    except Exception:
        return secrets.token_hex(32).encode("utf-8"), "random-per-process"


_SECRET, SECRET_SOURCE = _load_secret()


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in user.items() if k not in ("passwords", "passwordHint")}


def authenticate_user(email_input: str, password_input: str) -> dict[str, Any]:
    clean_email = email_input.strip().lower()
    clean_password = password_input.strip()

    found = next((u for u in SYSTEM_USERS if u["email"].lower() == clean_email), None)
    if found is None:
        if clean_email in ("emp1", "emp1@lahotioverseas.com", "javier"):
            found = next((u for u in SYSTEM_USERS if u["id"] == "user_javier"), None)
        elif clean_email in ("emp2", "emp2@lahotioverseas.com", "mehadi"):
            found = next((u for u in SYSTEM_USERS if u["id"] == "user_mehadi"), None)

    if found is None:
        return {"success": False, "error": "No account found with this email or ID (try emp1 or emp2)."}

    if not any(p == clean_password or p.lower() == clean_password.lower() for p in found["passwords"]):
        return {
            "success": False,
            "error": f"Incorrect password for {found['name']}. Please try again or ask the Admin.",
        }
    return {"success": True, "user": found}


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign_auth_token(payload: dict[str, Any]) -> str:
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64e(hmac.new(_SECRET, body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_auth_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    body, _, sig = token.partition(".")
    expected = _b64e(hmac.new(_SECRET, body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_b64d(body))
    except Exception:
        return None
    if not isinstance(payload, dict) or not payload.get("role"):
        return None
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and exp < now_ms():
        return None
    return payload


def token_from_header(authorization: str | None) -> str:
    raw = (authorization or "").strip()
    return raw[7:].strip() if raw.startswith("Bearer ") else raw


def admin_from_header(authorization: str | None) -> dict[str, Any] | None:
    payload = verify_auth_token(token_from_header(authorization))
    if payload and payload.get("role") == "admin":
        return payload
    return None
