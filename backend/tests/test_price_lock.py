"""12:00 AM IST daily price lock: locked until an Admin keeps previous prices or
edits the Google Sheet and publishes; unlocked for everyone until the next midnight."""
from app.services import auth

REF_INPUTS = {
    "p_product_code": "COTTON", "p_ex_mill": 338, "p_origin": "Gujarat", "p_destination": "Chittagong",
    "p_fob_rate_id": 1, "p_qty": 21000, "p_bci": 0, "p_margin_term_code": "LC_SIGHT", "p_usd_inr": 95.4,
}


def status(client):
    return client.get("/api/daily-pricing").json()["status"]


def calc(client):
    return client.post("/api/rpc/calculate_costing", json=REF_INPUTS).json()


# ------------------------------------------------------------------ locking at midnight

def test_prices_are_locked_when_not_confirmed_today(client, set_today):
    set_today("2026-10-30")  # seed snapshot was confirmed on 2026-10-29
    s = status(client)
    assert s["isConfirmedForToday"] is False
    assert s["todayDate"] == "2026-10-30"
    res = calc(client)
    assert res["data"] is None
    assert "Prices are locked at 00:00 AM IST" in res["error"]
    save = client.post("/api/rpc/save_costing", json={"p_inputs": {}, "p_outputs": {}}).json()
    assert "Prices are locked" in save["error"]


def test_unlocked_day_locks_again_after_midnight_ist(client, admin_headers, set_today):
    set_today("2026-10-30")
    client.post("/api/daily-pricing/keep-previous", headers=admin_headers, json={})
    assert status(client)["isConfirmedForToday"] is True
    assert calc(client)["error"] is None

    set_today("2026-10-31")  # clock passes 12:00 AM IST
    assert status(client)["isConfirmedForToday"] is False
    assert "Prices are locked" in calc(client)["error"]


def test_deal_creation_blocked_while_locked(client, set_today):
    set_today("2026-10-30")
    res = client.post("/api/zoho/create-deal", json={"account_name": "X"})
    assert res.status_code == 400
    assert "Prices are not updated for today" in res.json()["error"]


# ------------------------------------------------------------------ only an admin can unlock

def test_unlock_requires_admin(client, employee_headers, set_today):
    set_today("2026-10-30")
    for path in ("/api/daily-pricing/keep-previous", "/api/daily-pricing/start-edit",
                 "/api/google-sheet/sync-from-sheets", "/api/google-sheet/preview-sync"):
        assert client.post(path, json={"confirmedBy": "Someone"}).status_code == 403, path
        assert client.post(path, headers=employee_headers, json={}).status_code == 403, path
    # forged (unsigned, old-style base64) admin token is rejected
    forged = "eyJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiWCJ9"
    assert client.post("/api/daily-pricing/keep-previous", headers={"Authorization": f"Bearer {forged}"}).status_code == 403
    assert status(client)["isConfirmedForToday"] is False


def test_login_issues_signed_admin_token(client, set_today):
    set_today("2026-10-30")
    res = client.post("/api/auth/login", json={"email": "aadhitiya@lahotioverseas.com", "password": "Aadhitiya@123"}).json()
    assert res["success"] is True and "passwords" not in res["user"]
    assert auth.verify_auth_token(res["token"])["role"] == "admin"
    unlock = client.post("/api/daily-pricing/keep-previous", headers={"Authorization": f"Bearer {res['token']}"}, json={})
    assert unlock.status_code == 200


# ------------------------------------------------------------------ option 1: keep previous

def test_keep_previous_unlocks_immediately_with_same_prices(client, admin_headers, set_today):
    set_today("2026-10-30")
    before = client.get("/api/daily-pricing").json()["sheets"]
    res = client.post("/api/daily-pricing/keep-previous", headers=admin_headers, json={"confirmedBy": "Aadhitiya Lahoti"}).json()
    assert res["success"] is True
    s = res["status"]
    assert s["isConfirmedForToday"] is True
    assert s["confirmationType"] == "kept_previous"
    assert s["lastConfirmedBy"] == "Aadhitiya Lahoti"
    assert s["lastConfirmedDate"] == "2026-10-30"
    assert res["sheets"] == before
    assert calc(client)["error"] is None


# ------------------------------------------------------------------ option 2: edit in Google Sheet, then publish

def test_edit_in_sheet_then_publish_flow(client, admin_headers, set_today, fake_google_sheets):
    set_today("2026-10-30")

    # Admin clicks "Edit": prices stay locked, system remembers editing is in progress
    s = client.post("/api/daily-pricing/start-edit", headers=admin_headers, json={}).json()["status"]
    assert s["isEditingInSheet"] is True
    assert s["editingBy"] == "Aadhitiya Lahoti"
    assert s["isConfirmedForToday"] is False
    assert "Prices are locked" in calc(client)["error"]

    # Status survives a closed tab / new login: any fresh status call still says "editing"
    assert status(client)["isEditingInSheet"] is True

    # Coming back via the link inside the Google Sheet lands on the dashboard, still locked
    back = client.get("/api/daily-pricing/confirm-from-sheet?employee=emp1", headers={"Accept": "text/html"}, follow_redirects=False)
    assert back.status_code == 302
    assert back.headers["location"].startswith("/?action=return-from-sheet&employee=emp1")
    assert status(client)["isConfirmedForToday"] is False

    # Preview shows what changed in the sheet
    preview = client.post("/api/google-sheet/preview-sync", headers=admin_headers, json={}).json()
    assert preview["success"] is True
    changed = {(c["category"], c["product"]): (c["oldPrice"], c["newPrice"]) for c in preview["changes"]}
    assert changed[("Yarn", "NE 16/1 KH ( KH - A)")] == (257, 300)
    assert changed[("Freight", "Chittagong")][1] == 1000
    assert ("Yarn", "NE 20/1 KH ( KH - A)") not in changed  # unchanged price

    # "Publish Prices" pulls the sheet and unlocks for everyone
    pub = client.post("/api/google-sheet/sync-from-sheets", headers=admin_headers, json={"confirmedBy": "Aadhitiya Lahoti"}).json()
    assert pub["success"] is True
    s = pub["status"]
    assert s["isConfirmedForToday"] is True
    assert s["confirmationType"] == "updated_prices"
    assert s["isEditingInSheet"] is False

    yarn = client.get("/api/google-sheet/yarn-products").json()
    prices = {(r["yarnCount"], r["quality"]): r["exMillPrice"] for r in yarn["records"]}
    assert prices[("NE 16/1", "KH ( KH - A)")] == 300
    assert prices[("NE 99/1", "NEW QUALITY")] == 555
    assert yarn["isConfirmedForToday"] is True

    freight = client.get("/api/google-sheet/freight-rates").json()
    assert {r["destination"]: r["amount"] for r in freight["records"]} == {"Chittagong": 1000, "Hamburg": 2700}

    # Employees can now calculate (no token needed)
    assert calc(client)["error"] is None


def test_keep_previous_cancels_editing(client, admin_headers, set_today):
    set_today("2026-10-30")
    client.post("/api/daily-pricing/start-edit", headers=admin_headers, json={})
    s = client.post("/api/daily-pricing/keep-previous", headers=admin_headers, json={}).json()["status"]
    assert s["isConfirmedForToday"] is True and s["isEditingInSheet"] is False


def test_editing_flag_expires_with_the_day(client, admin_headers, set_today):
    set_today("2026-10-30")
    client.post("/api/daily-pricing/start-edit", headers=admin_headers, json={})
    set_today("2026-10-31")
    s = status(client)
    assert s["isEditingInSheet"] is False and s["isConfirmedForToday"] is False


def test_sheet_returning_html_is_reported_and_stays_locked(client, admin_headers, set_today, fake_google_sheets):
    set_today("2026-10-30")
    fake_google_sheets["yarn"] = "<!DOCTYPE html><html>Sign in</html>"
    res = client.post("/api/google-sheet/sync-from-sheets", headers=admin_headers, json={})
    assert res.status_code == 400
    assert "returned HTML instead of CSV" in res.json()["error"]
    assert status(client)["isConfirmedForToday"] is False


def test_confirm_from_sheet_api_call_publishes_for_admin_only(client, admin_headers, set_today, fake_google_sheets):
    set_today("2026-10-30")
    anon = client.post("/api/daily-pricing/confirm-from-sheet", headers={"Accept": "application/json"}, json={"employee": "emp1"})
    assert anon.status_code == 403 and anon.json()["requiresPublish"] is True
    assert status(client)["isConfirmedForToday"] is False

    ok = client.post("/api/daily-pricing/confirm-from-sheet", headers={**admin_headers, "Accept": "application/json"},
                     json={"employee": "emp1"}).json()
    assert ok["success"] is True and ok["status"]["isConfirmedForToday"] is True
    assert ok["status"]["lastConfirmedBy"] == "Employee (EMP1)"


def test_rows_unchanged_by_background_refresh_while_locked(client, set_today, fake_google_sheets):
    set_today("2026-10-30")
    before = client.get("/api/daily-pricing").json()["sheets"]
    client.get("/api/google-sheet/yarn-products?refresh=true")
    assert client.get("/api/daily-pricing").json()["sheets"] == before


def test_history_and_restore_admin_only(client, admin_headers, set_today):
    set_today("2026-10-30")
    client.post("/api/daily-pricing/keep-previous", headers=admin_headers, json={})
    assert client.get("/api/daily-pricing/history").status_code == 403
    hist = client.get("/api/daily-pricing/history", headers=admin_headers).json()["history"]
    assert hist[0]["confirmedDate"] == "2026-10-30"
    restored = client.post("/api/daily-pricing/restore", headers=admin_headers, json={"id": "2026-10-30"}).json()
    assert restored["success"] is True and restored["draftSheets"]["yarn"]["rows"]
