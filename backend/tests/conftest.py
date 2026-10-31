import os
import sys
import tempfile
from pathlib import Path

# Configure before the app is imported: local file storage in a throwaway folder, no Atlas.
_TMP = tempfile.mkdtemp(prefix="yarn_costing_tests_")
os.environ["DATA_DIR"] = _TMP
os.environ["MONGODB_ENABLED"] = "false"
os.environ["AUTH_SECRET"] = "test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402
from app.services import auth, fx, ist_time, persistence, pricing_store, sheet_sync  # noqa: E402


@pytest.fixture(autouse=True)
def offline_fx(monkeypatch):
    """Never call the real FX providers from tests."""
    monkeypatch.setattr(fx, "fetch_realtime_fx_rates",
                        lambda: {"usdInr": 95.43, "eurInr": 111.36, "dateStr": "2026-10-30", "isFallback": False})


@pytest.fixture(autouse=True)
def fresh_store():
    """Every test starts from the seed snapshot (last confirmed 2026-10-29, i.e. locked unless today is that date)."""
    persistence.reset_for_tests()
    for name in ("daily_pricing_store.json", "daily_pricing_history.json", "app_settings.json"):
        p = Path(config.DATA_DIR) / name
        if p.exists():
            p.unlink()
    pricing_store.reset_for_tests()
    yield


@pytest.fixture
def client():
    # Not used as a context manager -> lifespan (live FX fetch) does not run, tests stay offline.
    return TestClient(app)


def _token(user_id: str) -> str:
    user = next(u for u in auth.SYSTEM_USERS if u["id"] == user_id)
    return auth.sign_auth_token({"uid": user["id"], "role": user["role"], "name": user["name"], "exp": 99999999999999})


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {_token('user_aadhitiya')}"}


@pytest.fixture
def employee_headers():
    return {"Authorization": f"Bearer {_token('user_javier')}"}


@pytest.fixture
def set_today(monkeypatch):
    """Pretend the IST calendar date is `date` (simulates the 12:00 AM rollover)."""
    def _set(date: str):
        monkeypatch.setattr(ist_time, "today_ist", lambda: date)
        monkeypatch.setattr(pricing_store, "today_ist", lambda: date)
    return _set


@pytest.fixture
def unlocked(client, admin_headers):
    res = client.post("/api/daily-pricing/keep-previous", headers=admin_headers, json={"confirmedBy": "Aadhitiya Lahoti"})
    assert res.json()["status"]["isConfirmedForToday"] is True
    return res.json()["status"]


YARN_CSV = """Yarn Count,Quality,Ex-Mill Price (INR),Factory Location
NE 16/1,KH ( KH - A),300,Gujrat
NE 20/1,KH ( KH - A),261,Gujrat
NE 99/1,NEW QUALITY,555,Surat
"""
FOB_CSV = """Location,Price
Mundra,71000
North,125000
"""
FREIGHT_CSV = """FREIGHT,
Destination Port,AMOUNT
Chittagong,1000
Hamburg,2700
"""


@pytest.fixture
def fake_google_sheets(monkeypatch):
    """Serve fixed CSVs instead of calling docs.google.com. Mutate the dict to simulate edits."""
    sheets = {"yarn": YARN_CSV, "fob": FOB_CSV, "freight": FREIGHT_CSV}

    async def fake_fetch(_client, url: str) -> str:
        if "1401052388" in url:
            return sheets["fob"]
        if "1549189100" in url:
            return sheets["freight"]
        return sheets["yarn"]

    monkeypatch.setattr(sheet_sync, "_fetch_text", fake_fetch)
    return sheets
