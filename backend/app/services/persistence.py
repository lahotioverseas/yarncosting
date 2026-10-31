"""Small shared-state helpers. On Vercel every request may hit a different serverless
instance, so anything that must survive between requests lives in MongoDB; locally it
falls back to a JSON file / process memory."""
from __future__ import annotations

import copy
import json
import logging
import threading
from pathlib import Path
from typing import Any

from .. import config
from . import db

log = logging.getLogger(__name__)

SETTINGS_COLLECTION = "app_settings"
_lock = threading.Lock()
_memory_records: dict[str, list[dict[str, Any]]] = {}


def _settings_file() -> Path:
    return Path(config.DATA_DIR) / "app_settings.json"


def _read_settings_file() -> dict[str, Any]:
    try:
        if _settings_file().exists():
            return json.loads(_settings_file().read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def get_setting(key: str, default: Any = None) -> Any:
    database = db.get_db()
    if database is not None:
        try:
            doc = database[SETTINGS_COLLECTION].find_one({"_id": key})
            if doc is not None:
                return doc.get("value")
        except Exception as e:
            log.warning("Setting read failed (%s): %s", key, e)
    return _read_settings_file().get(key, copy.deepcopy(default))


def set_setting(key: str, value: Any) -> None:
    with _lock:
        data = _read_settings_file()
        data[key] = value
        try:
            _settings_file().write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            log.warning("Could not write local settings: %s", e)
    database = db.get_db()
    if database is not None:
        try:
            database[SETTINGS_COLLECTION].update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)
        except Exception as e:
            log.warning("Setting write failed (%s): %s", key, e)


def insert_record(collection: str, doc: dict[str, Any]) -> None:
    database = db.get_db()
    if database is not None:
        try:
            database[collection].insert_one(copy.deepcopy(doc))
            return
        except Exception as e:
            log.warning("Insert into %s failed, keeping in memory: %s", collection, e)
    with _lock:
        _memory_records.setdefault(collection, []).insert(0, doc)


def find_record(collection: str, field: str, value: Any) -> dict[str, Any] | None:
    database = db.get_db()
    if database is not None:
        try:
            doc = database[collection].find_one({field: value}, {"_id": 0})
            if doc is not None:
                return doc
        except Exception as e:
            log.warning("Read from %s failed: %s", collection, e)
    return next((r for r in _memory_records.get(collection, []) if r.get(field) == value), None)


def list_records(collection: str, sort_field: str = "created_at", limit: int = 500) -> list[dict[str, Any]]:
    database = db.get_db()
    if database is not None:
        try:
            return list(database[collection].find({}, {"_id": 0}).sort(sort_field, -1).limit(limit))
        except Exception as e:
            log.warning("List %s failed: %s", collection, e)
    return list(_memory_records.get(collection, []))[:limit]


def delete_records(collection: str, field: str, value: Any) -> None:
    database = db.get_db()
    if database is not None:
        try:
            database[collection].delete_many({field: value})
        except Exception as e:
            log.warning("Delete from %s failed: %s", collection, e)
    with _lock:
        _memory_records[collection] = [r for r in _memory_records.get(collection, []) if r.get(field) != value]


def reset_for_tests() -> None:
    _memory_records.clear()
