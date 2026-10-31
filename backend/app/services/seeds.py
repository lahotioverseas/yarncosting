"""Static seed data exported from the original TypeScript modules."""
import copy
import json
from functools import lru_cache
from typing import Any

from ..config import SEED_DIR


@lru_cache(maxsize=None)
def _load(name: str) -> Any:
    with open(SEED_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def default_pricing_snapshot() -> dict[str, Any]:
    """Fresh deep copy of the initial pricing snapshot (Yarn, FOB, Freight sheets)."""
    return copy.deepcopy(_load("default_pricing_snapshot.json"))


def system_users() -> list[dict[str, Any]]:
    return copy.deepcopy(_load("system_users.json"))


def zoho_fallback_accounts() -> list[dict[str, Any]]:
    return copy.deepcopy(_load("zoho_fallback_accounts.json"))


def drip_seed() -> dict[str, Any]:
    return copy.deepcopy(_load("drip_seed.json"))
