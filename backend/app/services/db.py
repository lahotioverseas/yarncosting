"""Shared MongoDB connection. Retries after a short back-off instead of giving up for the
whole process (on Vercel one instance can live for hours)."""
from __future__ import annotations

import logging
import time

import certifi
from pymongo import MongoClient

from .. import config
from . import mongo_manager

log = logging.getLogger(__name__)

RETRY_AFTER_SECONDS = 30

_client: MongoClient | None = None
_client_uri: str | None = None
_failed_at: float | None = None


def tls_options(uri: str) -> dict:
    """Use certifi's CA bundle for Atlas TLS (Windows Python often has no usable system CA store)."""
    return {"tlsCAFile": certifi.where()} if uri.startswith("mongodb+srv://") or "tls=true" in uri.lower() else {}


def mongo_configured() -> bool:
    uri = mongo_manager.ACTIVE_MONGODB_URI
    return bool(config.MONGODB_ENABLED and uri and "<username>" not in uri and "YOUR_USERNAME" not in uri)


def get_db():
    """Database handle, or None when Mongo is disabled/unreachable (callers fall back to local files)."""
    global _client, _client_uri, _failed_at
    if not mongo_configured():
        return None
    if _failed_at is not None and time.monotonic() - _failed_at < RETRY_AFTER_SECONDS:
        return None
    uri = mongo_manager.ACTIVE_MONGODB_URI
    try:
        if _client is None or _client_uri != uri:
            client = MongoClient(uri, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, **tls_options(uri))
            client.admin.command("ping")
            _client, _client_uri = client, uri
        _failed_at = None
        return _client[mongo_manager.DB_NAME]
    except Exception as err:
        _failed_at = time.monotonic()
        msg = str(err)
        if "bad auth" in msg or "authentication failed" in msg.lower():
            log.warning("MongoDB authentication failed (bad auth). Using local file storage for now.")
        else:
            log.warning("MongoDB unavailable (%s). Using local file storage for now.", msg[:160])
        return None


def reset() -> None:
    global _client, _client_uri, _failed_at
    _client, _client_uri, _failed_at = None, None, None
