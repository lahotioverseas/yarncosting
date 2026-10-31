"""Zoho CRM integration: OAuth token (with regional fallback), cached accounts /
contacts / agents, product resolution, deal + follow-up task creation.
Port of the Zoho section of the original server-app.ts."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from .. import config
from .jsutil import now_ms
from .seeds import zoho_fallback_accounts

log = logging.getLogger(__name__)

TOKEN_CACHE_FILE = Path(config.DATA_DIR) / "zoho_token_cache.json"
ACCOUNTS_CACHE_FILE = Path(config.DATA_DIR) / "zoho_accounts_cache.json"
_TIMEOUT = httpx.Timeout(20.0)

DEFAULT_OWNER_ID = "3377374000000364001"  # Saurabh Lahoti

ZOHO_USER_DIRECTORY: dict[str, dict[str, str]] = {
    "mehadi@lahotioverseas.com": {"id": "3377374000000368001", "name": "Mehadi Hasan", "email": "mehadi@lahotioverseas.com"},
    "javier@lahotioverseas.com": {"id": "3377374000000365009", "name": "Javier Moreano", "email": "javier@lahotioverseas.com"},
    "aadhitiya@lahotioverseas.com": {"id": "3377374000000166021", "name": "Aadhitiya Lahoti", "email": "aadhitiya@lahotioverseas.com"},
    "saurabh@lahotioverseas.com": {"id": "3377374000000364001", "name": "Saurabh Lahoti", "email": "saurabh@lahotioverseas.com"},
    "rashmi@lahotioverseas.com": {"id": "3377374000011184001", "name": "Rashmi Shishivkar", "email": "rashmi@lahotioverseas.com"},
    "tusshar@lahotioverseas.com": {"id": "3377374000051365001", "name": "Tusshar Manekarr", "email": "tusshar@lahotioverseas.com"},
    "avinash@lahotioverseas.com": {"id": "3377374000057075001", "name": "Avinash", "email": "avinash@lahotioverseas.com"},
    "mahnaz@lahotioverseas.com": {"id": "3377374000070870001", "name": "Mahnaz Kausar Kausar", "email": "mahnaz@lahotioverseas.com"},
    "yogita@lahotioverseas.com": {"id": "3377374000001489006", "name": "Yogita Sawant", "email": "yogita@lahotioverseas.com"},
    "vineet@lahotioverseas.com": {"id": "3377374000001498001", "name": "Vineet Parihar", "email": "vineet@lahotioverseas.com"},
    "pallavi@lahotioverseas.com": {"id": "3377374000040857001", "name": "Pallavi Kuldhar", "email": "pallavi@lahotioverseas.com"},
}


def clean_zoho_string(s: str | None) -> str:
    if not s:
        return ""
    clean = s.strip()
    if (clean.startswith('"') and clean.endswith('"')) or (clean.startswith("'") and clean.endswith("'")):
        clean = clean[1:-1].strip()
    return clean


def clean_zoho_domain(domain: str | None, default: str) -> str:
    raw = clean_zoho_string(domain)
    if not raw:
        return default
    clean = re.sub(r"^https?://", "", raw, flags=re.IGNORECASE)
    clean = re.sub(r"/+$", "", clean)
    return clean or default


def zoho_configured() -> bool:
    return all(
        clean_zoho_string(os.environ.get(k)) and not clean_zoho_string(os.environ.get(k)).upper().startswith("YOUR_")
        for k in ("ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN")
    )


def default_api_domain() -> str:
    return clean_zoho_domain(os.environ.get("ZOHO_API_DOMAIN"), "www.zohoapis.com")


def _read_json(path: Path) -> Any:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


def _write_json(path: Path, data: Any) -> None:
    try:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


cached_token: dict[str, Any] | None = None
_saved_token = _read_json(TOKEN_CACHE_FILE)
if _saved_token and _saved_token.get("expiresAt", 0) > now_ms() + 60000:
    cached_token = _saved_token

cached_accounts: dict[str, Any] | None = None
_saved_accounts = _read_json(ACCOUNTS_CACHE_FILE)
if _saved_accounts and isinstance(_saved_accounts.get("items"), list) and _saved_accounts["items"]:
    cached_accounts = _saved_accounts

_accounts_task: asyncio.Task | None = None
_products_cache: dict[str, dict[str, str]] = {}


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Zoho-oauthtoken {token}"}


async def get_access_token() -> dict[str, Any]:
    global cached_token
    if cached_token and cached_token.get("expiresAt", 0) > now_ms():
        return {"token": cached_token["token"], "apiDomain": cached_token["apiDomain"]}

    def env_value(name: str) -> str:
        v = clean_zoho_string(os.environ.get(name))
        return "" if v.upper().startswith("YOUR_") else v  # .env.example placeholder

    client_id = env_value("ZOHO_CLIENT_ID")
    client_secret = env_value("ZOHO_CLIENT_SECRET")
    refresh_token = env_value("ZOHO_REFRESH_TOKEN")

    if not client_id or not client_secret or not refresh_token:
        return {"token": None, "error": "Zoho credentials not fully configured (set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)"}

    primary_accounts = clean_zoho_domain(os.environ.get("ZOHO_ACCOUNTS_DOMAIN"), "accounts.zoho.com")
    primary_api = default_api_domain()

    regions = [
        {"accounts": primary_accounts, "api": primary_api},
        {"accounts": "accounts.zoho.in", "api": "www.zohoapis.in"},
        {"accounts": "accounts.zoho.com", "api": "www.zohoapis.com"},
        {"accounts": "accounts.zoho.eu", "api": "www.zohoapis.eu"},
        {"accounts": "accounts.zoho.com.au", "api": "www.zohoapis.com.au"},
        {"accounts": "accounts.zoho.com.cn", "api": "www.zohoapis.com.cn"},
        {"accounts": "accounts.zoho.jp", "api": "www.zohoapis.jp"},
    ]
    seen: set[str] = set()
    unique = []
    for r in regions:
        if r["accounts"] not in seen:
            seen.add(r["accounts"])
            unique.append(r)

    last_error = "Unknown error"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for region in unique:
            try:
                res = await client.post(
                    f"https://{region['accounts']}/oauth/v2/token",
                    data={
                        "refresh_token": refresh_token,
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "grant_type": "refresh_token",
                    },
                )
                data = res.json()
                if data and data.get("access_token"):
                    expires_in = data["expires_in"] if isinstance(data.get("expires_in"), (int, float)) else 3600
                    cached_token = {
                        "token": data["access_token"],
                        "apiDomain": region["api"],
                        "expiresAt": now_ms() + int((expires_in - 300) * 1000),
                    }
                    _write_json(TOKEN_CACHE_FILE, cached_token)
                    return {"token": data["access_token"], "apiDomain": region["api"]}
                last_error = (data or {}).get("error_description") or (data or {}).get("error") or "Unknown token error"
                if last_error != "invalid_client" and "too many requests" not in last_error:
                    break
            except Exception as err:
                last_error = str(err) or "Network error"

    if last_error == "invalid_client":
        return {"token": None, "error": "invalid_client: Please verify ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN in .env"}
    if last_error in ("invalid_code", "invalid_token"):
        return {"token": None, "error": "invalid_token: ZOHO_REFRESH_TOKEN has expired or is invalid"}
    if "too many requests" in last_error:
        return {"token": None, "error": "Rate limit: Zoho OAuth is cooling down from repeated requests. Please try again in 1-2 minutes."}
    return {"token": None, "error": f"Zoho OAuth Error: {last_error}"}


async def _safe_json(client: httpx.AsyncClient, url: str, token: str) -> Any:
    try:
        res = await client.get(url, headers=_auth(token))
        if res.status_code >= 400 or res.status_code == 204:
            return None
        text = res.text
        if not text or not text.strip():
            return None
        return json.loads(text)
    except Exception:
        return None


_PLACEHOLDER_NAMES = {"sir", "madam", "sir/madam", "dear sir", "dear madam", "dearsir", "null", "undefined", "n/a", "na", "none"}


def _fallback_items() -> list[dict[str, Any]]:
    if cached_accounts and cached_accounts.get("items"):
        return cached_accounts["items"]
    return zoho_fallback_accounts()


def _owner(o: Any) -> tuple[str, str, str]:
    o = o or {}
    return (o.get("name") or o.get("full_name") or "", o.get("email") or "", o.get("id") or "")


async def fetch_and_cache_accounts(force_domain: str | None = None) -> dict[str, Any]:
    global cached_accounts
    try:
        tok = await get_access_token()
        access_token = tok.get("token")
        api_domain = force_domain or tok.get("apiDomain") or default_api_domain()
        if not access_token:
            return {
                "items": _fallback_items(),
                "is_connected": False,
                "error": tok.get("error") or "Zoho access token unavailable",
                "message": "Using fallback accounts",
            }

        acc_url = f"https://{api_domain}/crm/v2/Accounts?fields=Account_Name,Owner&per_page=200&page={{}}"
        con_url = (
            f"https://{api_domain}/crm/v2/Contacts?fields=Full_Name,First_Name,Last_Name,Account_Name,Owner,Email,Phone,Mobile"
            "&per_page=200&page={}"
        )
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            acc_p1, con_p1, agents_res, vendors_res = await asyncio.gather(
                _safe_json(client, acc_url.format(1), access_token),
                _safe_json(client, con_url.format(1), access_token),
                _safe_json(client, f"https://{api_domain}/crm/v2/Agents?per_page=200", access_token),
                _safe_json(client, f"https://{api_domain}/crm/v2/Vendors?fields=Vendor_Name,Owner&per_page=200", access_token),
            )
            acc_others, con_others = await asyncio.gather(
                asyncio.gather(*[_safe_json(client, acc_url.format(p), access_token) for p in (2, 3, 4, 5, 6)]),
                asyncio.gather(*[_safe_json(client, con_url.format(p), access_token) for p in (2, 3, 4)]),
            )

        raw_accounts = list((acc_p1 or {}).get("data") or [])
        for r in acc_others:
            if r and isinstance(r.get("data"), list):
                raw_accounts.extend(r["data"])
        raw_contacts = list((con_p1 or {}).get("data") or [])
        for r in con_others:
            if r and isinstance(r.get("data"), list):
                raw_contacts.extend(r["data"])

        contact_map: dict[str, dict[str, Any]] = {}
        for c in raw_contacts:
            full = (c.get("Full_Name") or f"{c.get('First_Name') or ''} {c.get('Last_Name') or ''}").strip()
            info = {"name": full, "id": c.get("id"), "email": c.get("Email") or "", "phone": c.get("Mobile") or c.get("Phone") or ""}
            acc = c.get("Account_Name") or {}
            if acc.get("id"):
                contact_map[acc["id"]] = info
            if acc.get("name"):
                contact_map[acc["name"].lower().strip()] = info

        items: list[dict[str, Any]] = []
        for acc in raw_accounts:
            if not acc.get("Account_Name"):
                continue
            owner_name, owner_email, owner_id = _owner(acc.get("Owner"))
            contact = contact_map.get(acc.get("id")) or contact_map.get(acc["Account_Name"].lower().strip())
            item = {
                "id": acc.get("id"), "name": acc["Account_Name"], "type": "Account",
                "owner_name": owner_name, "owner_email": owner_email, "owner_id": owner_id,
            }
            if contact:
                item.update({
                    "contact_name": contact["name"], "contact_id": contact["id"],
                    "contact_email": contact["email"], "contact_phone": contact["phone"],
                })
            items.append(item)

        for ag in (agents_res or {}).get("data") or []:
            name = ag.get("Agent_Name") or ag.get("Name") or ag.get("Full_Name") or ag.get("Vendor_Name")
            if isinstance(name, str) and name.strip():
                owner_name, owner_email, owner_id = _owner(ag.get("Owner"))
                items.append({"id": ag.get("id"), "name": name.strip(), "type": "Agent",
                              "owner_name": owner_name, "owner_email": owner_email, "owner_id": owner_id})

        for v in (vendors_res or {}).get("data") or []:
            name = v.get("Vendor_Name")
            if isinstance(name, str) and name.strip():
                owner_name, owner_email, owner_id = _owner(v.get("Owner"))
                items.append({"id": v.get("id"), "name": name.strip(), "type": "Vendor",
                              "owner_name": owner_name, "owner_email": owner_email, "owner_id": owner_id})

        seen_ids: set[Any] = set()
        dedup = []
        for item in items:
            nm = item.get("name")
            if not isinstance(nm, str) or not nm.strip() or nm.strip().lower() in _PLACEHOLDER_NAMES:
                continue
            if item.get("id") in seen_ids:
                continue
            seen_ids.add(item.get("id"))
            dedup.append(item)

        if dedup:
            payload = {"items": dedup, "is_connected": True, "error": None, "timestamp": now_ms()}
            cached_accounts = payload
            _write_json(ACCOUNTS_CACHE_FILE, payload)
            return payload

        return {"items": _fallback_items(), "is_connected": False, "error": "No accounts retrieved from Zoho CRM"}
    except Exception as err:
        log.error("Error fetching Zoho accounts: %s", err)
        return {"items": _fallback_items(), "is_connected": False, "error": str(err)}


def _start_accounts_fetch() -> asyncio.Task:
    global _accounts_task
    if _accounts_task is None or _accounts_task.done():
        _accounts_task = asyncio.create_task(fetch_and_cache_accounts())
    return _accounts_task


async def get_accounts_and_agents(force_refresh: bool) -> dict[str, Any]:
    if not force_refresh and cached_accounts and cached_accounts.get("items"):
        if now_ms() - cached_accounts.get("timestamp", 0) > 10 * 60 * 1000 and (_accounts_task is None or _accounts_task.done()):
            _start_accounts_fetch()  # refresh in background
        return {
            "items": cached_accounts["items"],
            "is_connected": cached_accounts.get("is_connected"),
            "error": cached_accounts.get("error"),
            "cached": True,
            "cached_at": cached_accounts.get("timestamp"),
        }
    task = _start_accounts_fetch()
    return await asyncio.shield(task)


def resolve_zoho_user(email: str | None, name: str | None) -> dict[str, str] | None:
    if email:
        clean = email.strip().lower()
        if clean in ZOHO_USER_DIRECTORY:
            return ZOHO_USER_DIRECTORY[clean]
    if name:
        clean_name = name.strip().lower()
        for u in ZOHO_USER_DIRECTORY.values():
            un = u["name"].lower()
            if un == clean_name or clean_name in un or un in clean_name:
                return u
    return None


def map_quality_to_zoho_name(raw: str | None) -> str:
    if not raw:
        return ""
    trimmed = raw.strip()
    q = trimmed.upper()
    exact = {
        "KH": "KH - A", "CH": "CH-A", "CCH": "CH-A-CMPT", "KW": "KW - A", "CW": "CW - A", "CCW": "CW - A - CMPT",
        "KW/KH SOFT TWIST": "KH - A", "KH SOFT TWIST": "KH - A", "KW HARD TWIST": "KW - A",
        "CH SOFT TWIST": "CH-A", "CW HARD TWIST": "CW - A", "KCW": "KW - A",
    }
    if q in exact:
        return exact[q]
    for needle, val in (
        ("KW/KH", "KH - A"), ("KH SOFT", "KH - A"), ("KW HARD", "KW - A"), ("CCH", "CH-A-CMPT"), ("CCW", "CW - A - CMPT"),
        ("CH SOFT", "CH-A"), ("CW HARD", "CW - A"), ("KH", "KH - A"), ("KW", "KW - A"), ("CH", "CH-A"), ("CW", "CW - A"),
    ):
        if needle in q:
            return val
    return trimmed


def _strip_ne(count: str) -> str:
    return re.sub(r"^ne\s*", "", count, flags=re.IGNORECASE).strip()


def format_zoho_product_name(yarn_count: str | None, quality: str | None) -> str:
    clean_count = _strip_ne(yarn_count or "")
    zq = map_quality_to_zoho_name(quality)
    if not clean_count:
        return zq
    if not zq:
        return clean_count
    return f"{clean_count} {zq}"


async def resolve_or_create_product(client: httpx.AsyncClient, product: dict[str, Any], token: str, api_domain: str) -> dict[str, str] | None:
    try:
        raw_count = str(product.get("yarnCount") or "").strip()
        raw_quality = str(product.get("quality") or "").strip()
        zq = map_quality_to_zoho_name(raw_quality)
        clean_count = _strip_ne(raw_count)
        zoho_name = format_zoho_product_name(raw_count, raw_quality)
        cache_key = f"{clean_count.lower()}_{zq.lower()}"
        if cache_key in _products_cache:
            return _products_cache[cache_key]

        if clean_count:
            try:
                res = await client.get(f"https://{api_domain}/crm/v2/Products/search?word={quote(clean_count, safe='')}", headers=_auth(token))
                if res.status_code < 400 and res.text.strip():
                    data = res.json()
                    found = data.get("data") if isinstance(data, dict) else None
                    if isinstance(found, list) and found:
                        q, c = zq.lower(), clean_count.lower()
                        exact = next(
                            (p for p in found
                             if (c in (p.get("Count") or "").lower() or c in (p.get("Product_Name") or "").lower())
                             and (not q or q in (p.get("Product_Name") or "").lower())),
                            None,
                        )
                        match = exact or found[0]
                        if match.get("id"):
                            result = {"id": str(match["id"]), "name": match.get("Product_Name") or zoho_name}
                            _products_cache[cache_key] = result
                            return result
            except Exception as e:
                log.warning("Product search error: %s", e)

        try:
            res = await client.post(
                f"https://{api_domain}/crm/v2/Products",
                headers={**_auth(token), "Content-Type": "application/json"},
                json={"data": [{"Product_Name": zoho_name, "Count": clean_count, "Product_Active": True,
                                "Unit_Price": product.get("usdPrice") or None}]},
            )
            if res.status_code < 400:
                new_id = ((res.json().get("data") or [{}])[0].get("details") or {}).get("id")
                if new_id:
                    result = {"id": str(new_id), "name": zoho_name}
                    _products_cache[cache_key] = result
                    return result
        except Exception as e:
            log.warning("Product creation error: %s", e)

        return {"id": "", "name": zoho_name}
    except Exception as e:
        log.warning("Error resolving or creating Zoho Product: %s", e)
    return None

