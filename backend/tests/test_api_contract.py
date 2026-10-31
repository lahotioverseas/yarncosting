"""Response shapes the React frontend depends on (same as the old Express server)."""
from app.services.jsutil import format_en_in, js_number, js_parse_float, to_fixed


def test_unknown_api_route_returns_json_404(client):
    res = client.post("/api/does-not-exist?x=1")
    assert res.status_code == 404
    assert res.json() == {"data": None, "error": "API route not found: POST /api/does-not-exist?x=1"}


def test_wrong_method_on_rpc_returns_json_404(client):
    assert client.get("/api/rpc/get_products").json()["error"].startswith("API route not found")


def test_malformed_json_returns_400(client):
    res = client.post("/api/auth/login", content=b"{bad", headers={"Content-Type": "application/json"})
    assert res.status_code == 400
    assert res.json() == {"success": False, "error": "Malformed JSON payload."}


def test_auth_users_hide_passwords(client):
    users = client.get("/api/auth/users").json()["users"]
    assert len(users) == 8 and all("passwords" not in u and "passwordHint" not in u for u in users)


def test_login_errors(client):
    assert client.post("/api/auth/login", json={"email": "x"}).status_code == 400
    bad = client.post("/api/auth/login", json={"email": "emp1", "password": "nope"})
    assert bad.status_code == 401 and "Incorrect password for Javier" in bad.json()["error"]
    assert "@123" not in bad.json()["error"]  # never leak the password hint
    ok = client.post("/api/auth/login", json={"email": "emp1", "password": "Emp1@123"}).json()
    assert ok["user"]["id"] == "user_javier" and ok["user"]["role"] == "employee"


def test_daily_pricing_payload_shape(client):
    body = client.get("/api/daily-pricing").json()
    assert body["success"] is True
    assert set(body["sheets"]) == {"yarn", "fob", "freight"}
    assert body["status"]["totalYarnProducts"] == len(body["sheets"]["yarn"]["rows"])
    freight_cols = [c["name"] for c in body["sheets"]["freight"]["columns"]]
    assert "Freight(USD)" in freight_cols


def test_live_records_endpoints_and_rpc_variants(client):
    yarn = client.get("/api/google-sheet/yarn-products").json()
    assert yarn["sourceUrl"] == "In-App Daily Pricing Master" and yarn["records"] and yarn["uniqueCounts"]
    fob = client.post("/api/rpc/get_google_sheet_fob_prices").json()
    assert fob["error"] is None and fob["data"]["locations"]
    freight = client.get("/api/google-sheet/freight-rates").json()
    assert "destinations" in freight and "dailyPricingStatus" in freight


def test_add_rows(client):
    d = client.post("/api/google-sheet/add-destination", json={"destination": "Surat Test", "amount": 1234}).json()
    assert d["success"] and "Surat Test" in d["destinations"]
    # Destination added to the pricing sheet is usable by the freight lookup
    r = client.post("/api/rpc/get_freight_rate", json={"p_destination": "Surat Test"}).json()["data"]
    assert r["available"] is True and r["selected_freight_usd"] == 1259
    f = client.post("/api/google-sheet/add-fob-location", json={"location": "Testpur", "price": "99000"}).json()
    assert f["success"] and "Testpur" in f["locations"]
    y = client.post("/api/google-sheet/add-yarn-product", json={"yarnCount": "NE 70/1", "quality": "CCH", "exMillPrice": 410}).json()
    assert y["success"] and "NE 70/1" in y["uniqueCounts"]
    assert client.post("/api/google-sheet/add-destination", json={}).status_code == 400


def test_config_urls_roundtrip(client, admin_headers):
    urls = client.get("/api/google-sheet/config-urls").json()["urls"]
    assert "export?format=csv" in urls["yarnCsvUrl"]
    assert client.post("/api/google-sheet/config-urls", json={"fobCsvUrl": "https://x"}).status_code == 403
    new = "https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=1"
    updated = client.post("/api/google-sheet/config-urls", headers=admin_headers, json={"fobCsvUrl": new}).json()["urls"]
    assert updated["fobCsvUrl"] == new
    assert client.get("/api/google-sheet/config-urls").json()["urls"]["fobCsvUrl"] == new  # persisted


def test_sheet_sync_only_reads_google_sheets(client, admin_headers):
    res = client.post("/api/google-sheet/sync-from-sheets", headers=admin_headers,
                      json={"yarnCsvUrl": "http://169.254.169.254/latest", "fobCsvUrl": "https://evil.example/f.csv",
                            "freightCsvUrl": "https://evil.example/x.csv"})
    assert res.status_code == 400 and "Only Google Sheets links" in res.json()["error"]


def test_publish_webhook_disabled(client):
    assert client.post("/api/google-sheet/publish-webhook").status_code == 403


def test_employee_sheets_save_and_read(client):
    assert client.get("/api/employee-sheets").json() == {"success": True, "employeeSheets": None}
    saved = client.post("/api/employee-sheets/save", json={"empId": "emp1", "patch": {"viewUrl": "https://x"}}).json()
    assert saved["employeeSheets"][0]["empId"] == "emp1"
    assert client.get("/api/employee-sheets").json()["employeeSheets"][0]["viewUrl"] == "https://x"
    assert client.post("/api/employee-sheets/save", json={}).status_code == 400


def test_master_data_and_update(client):
    data = client.post("/api/rpc/get_master_data").json()["data"]
    assert set(data) == {"products", "yarnCounts", "containerConfigs", "portLogistics", "financialParams", "fxRates"}
    client.post("/api/rpc/update_master_data", json={"target_table": "fx_rates_master",
                                                    "record": {"currency_pair": "USD_INR", "rate": 96.0, "fx_buffer_margin": 0.5}})
    usd = next(f for f in client.post("/api/rpc/get_fx_rates").json()["data"] if f["currency_pair"] == "USD_INR")
    assert usd["effective_rate"] == 95.5


def test_saved_quotes_crud(client):
    q = client.post("/api/rpc/save_costing_quote", json={"p_quote": {
        "customer_name": "ACME", "inputs": {"yarn_count_name": "NE 30/1", "container_type": "40FT_HC"},
        "results": {"cif_price_usd_per_kg": 3.2, "total_net_profit_usd": 900}}}).json()["data"]
    assert q["id"].startswith("sq_") and q["quote_number"].startswith("QT-")
    assert any(x["id"] == q["id"] for x in client.post("/api/rpc/get_saved_quotes").json()["data"])
    client.post("/api/rpc/delete_saved_quote", json={"id": q["id"]})
    assert not any(x["id"] == q["id"] for x in client.post("/api/rpc/get_saved_quotes").json()["data"])


def test_cotton_yarn_engine_rpc(client):
    r = client.post("/api/rpc/calculate_cotton_yarn_costing", json={"p_input": {"ex_mill_price_inr_per_kg": 338, "base_fx_rate": 95.4}}).json()
    assert r["error"] is None and len(r["data"]["fx_sensitivity"]) == 5


def test_lookup_rpcs(client):
    assert len(client.post("/api/rpc/get_fob_locations", json={}).json()["data"]) == 13
    assert len(client.post("/api/rpc/get_quantity_options", json={}).json()["data"]) == 5
    assert client.post("/api/rpc/get_margin_terms", json={}).json()["data"][0]["term_code"] == "LC_SIGHT"
    assert {"USD_INR", "EUR_INR"} == set(client.post("/api/rpc/get_exchange_rates", json={}).json()["data"])
    assert client.post("/api/rpc/get_freight_origins", json={}).json()["data"] == [
        {"origin": "Chennai"}, {"origin": "Gujarat"}, {"origin": "Maharashtra"}]


def test_mongo_routes_admin_only(client, admin_headers, employee_headers):
    for path in ("/api/mongo/set-uri", "/api/mongo/test", "/api/mongo/init", "/api/mongo/push-all-data"):
        assert client.post(path, json={}).status_code == 403
        assert client.post(path, headers=employee_headers, json={}).status_code == 403
    assert client.get("/api/mongo/status").status_code == 403
    assert client.post("/api/mongo/set-uri", headers=admin_headers, json={}).status_code == 400


def test_health_reports_configuration(client):
    h = client.get("/api/health").json()
    assert h["mongo"]["configured"] is False and h["vercel"] is False
    assert any("MONGODB_URI" in p for p in h["problems"])
    assert "2fTW" not in str(h)


def test_vercel_files_are_consistent():
    import json as _json
    from pathlib import Path as _P
    root = _P(__file__).resolve().parents[2]
    cfg = _json.loads((root / "vercel.json").read_text())
    assert cfg["outputDirectory"] == "frontend/dist"
    assert cfg["rewrites"][0] == {"source": "/api/(.*)", "destination": "/api/index"}
    assert "api/index.py" in cfg["functions"]
    reqs = (root / "requirements.txt").read_text()
    for pkg in ("fastapi", "httpx", "pymongo", "dnspython"):
        assert pkg in reqs
    assert "pytest" not in reqs  # dev-only, keeps the function small
    assert (root / "api" / "index.py").exists()


def test_spa_fallback_when_not_built(client, tmp_path, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "FRONTEND_DIST", tmp_path)
    assert client.get("/some/page").status_code == 404
    (tmp_path / "index.html").write_text("<html>app</html>")
    assert client.get("/some/page").text == "<html>app</html>"


def test_js_number_helpers():
    assert to_fixed(0.125, 2) == 0.13  # JS toFixed rounds ties up, unlike Python round()
    assert to_fixed(2.5, 0) == 3
    assert js_number("") == 0 and js_number(None) == 0
    assert js_number("12abc") != js_number("12abc")  # NaN
    assert js_parse_float("12.5.6") == 12.5
    assert format_en_in(125000) == "1,25,000"
    assert format_en_in(1234567.5) == "12,34,567.5"
