"""The README / ValidationView test matrix, run through the HTTP API (tolerance 0.0001).

Two README values no longer match the business rules in the code (true for the
original TypeScript server as well, see tests/fixtures/ts_golden.json):
  * Chittagong gets +0.25% margin (getMarginTermsForDestination), so LC at sight is
    3.25%, not 3%: USD price 3.5594824205 (README: 3.5508638190) and final target
    ex-mill 276.0499783125 (README: 276.7632857500).
  * Santos now has a published rate (6800 USD) in the Daily Pricing freight sheet,
    so Gujarat -> Santos is no longer blocked. A route with no rate anywhere still is.
"""
import pytest

TOL = 0.0001
USD_PRICE_CHITTAGONG = 3.5594824205  # margin 3.25% (README with 3%: 3.5508638190)
REF = {
    "p_product_code": "COTTON", "p_ex_mill": 338, "p_origin": "Gujarat", "p_destination": "Chittagong",
    "p_fob_rate_id": 1, "p_qty": 21000, "p_bci": 0, "p_margin_term_code": "LC_SIGHT", "p_usd_inr": 95.4,
}


def rpc(client, name, params):
    body = client.post(f"/api/rpc/{name}", json=params).json()
    assert body["error"] is None, body["error"]
    return body["data"]


@pytest.mark.usefixtures("unlocked")
class TestValidationMatrix:
    def test_reference_case(self, client):
        r = rpc(client, "calculate_costing", REF)
        assert r["selected_freight_usd"] == pytest.approx(975, abs=TOL)
        assert r["ddb_rodtep"] == pytest.approx(16.9, abs=TOL)
        assert r["net_ex_mill"] == pytest.approx(321.1, abs=TOL)
        assert r["fob_cost_per_kg"] == pytest.approx(3.3333333333, abs=TOL)
        assert r["freight_per_kg"] == pytest.approx(4.4525, abs=TOL)
        assert r["total_cost"] == pytest.approx(328.8858333333, abs=TOL)
        assert r["assumptions"]["margin_pct"] == 3.25
        assert r["usd_price"] == pytest.approx(USD_PRICE_CHITTAGONG, abs=TOL)

    def test_usd_price_with_three_percent_margin_matches_readme(self, client):
        # Same cost stack at a 3% margin destination (Port Louis has no surcharge rule) -> README formula
        r = rpc(client, "calculate_costing", {**REF, "p_selected_freight_usd": 975})
        total = r["total_cost"]
        assert (total * 1.03) / 95.4 == pytest.approx(3.5508638190, abs=TOL)

    def test_target_case(self, client):
        t = rpc(client, "calculate_costing", {**REF, "p_target_usd": 2.93})["target_calc"]
        assert t["allowed_ex_mill"] == pytest.approx(271.7361666667, abs=TOL)
        assert t["with_buffer"] == pytest.approx(285.3229750000, abs=TOL)
        assert t["after_interest"] == pytest.approx(285.3229750000, abs=TOL)
        assert t["final_target"] == pytest.approx(276.0499783125, abs=TOL)  # README (3%): 276.76328575

    def test_freight_table_stores_base_950(self, client):
        r = rpc(client, "get_freight_rate", {"p_product_code": "COTTON", "p_origin": "Gujarat", "p_destination": "Chittagong"})
        assert r["base_amount_usd"] == 950

    def test_maharashtra_destinations(self, client):
        d = rpc(client, "get_freight_destinations", {"p_product_code": "COTTON", "p_origin": "Maharashtra"})
        assert sorted(x["destination"] for x in d) == ["Casablanca", "Port Louis"]

    def test_route_without_rate_is_blocked(self, client):
        r = rpc(client, "get_freight_rate", {"p_product_code": "COTTON", "p_origin": "Gujarat", "p_destination": "Itajai"})
        assert r["available"] is False and r["base_amount_usd"] is None
        res = client.post("/api/rpc/calculate_costing", json={**REF, "p_destination": "Itajai"}).json()
        assert res["data"] is None and res["error"] == "no freight rate published for this route"

    def test_santos_uses_daily_pricing_sheet_rate(self, client):
        r = rpc(client, "get_freight_rate", {"p_product_code": "COTTON", "p_origin": "Gujarat", "p_destination": "Santos"})
        assert r["available"] is True and r["base_amount_usd"] == 6800

    def test_eur_missing_returns_usd_only(self, client):
        r = rpc(client, "calculate_costing", {**REF, "p_eur_inr": None})
        assert r["usd_price"] is not None and r["eur_price"] is None and r["eur_unavailable"] is True

    def test_freight_at_usd_inr_90(self, client):
        r = rpc(client, "calculate_costing", {**REF, "p_usd_inr": 90.0})
        assert r["freight_per_kg"] == pytest.approx(4.2017857143, abs=TOL)

    def test_save_then_replay_identical(self, client):
        ref_res = rpc(client, "calculate_costing", REF)
        ref_no = rpc(client, "save_costing", {
            "p_inputs": {"product_code": "COTTON", "ex_mill": 338, "origin": "Gujarat", "destination": "Chittagong",
                         "fob_rate_id": 1, "qty": 21000, "bci": 0, "margin_term_code": "LC_SIGHT"},
            "p_outputs": ref_res,
        })
        assert ref_no.startswith("QT-")
        replay = rpc(client, "replay_costing", {"p_reference_no": ref_no})
        assert replay["usd_price"] == pytest.approx(ref_res["usd_price"], abs=1e-12)
        assert replay["usd_price"] == pytest.approx(USD_PRICE_CHITTAGONG, abs=TOL)

    def test_replay_unknown_reference(self, client):
        res = client.post("/api/rpc/replay_costing", json={"p_reference_no": "QT-0000-0000"}).json()
        assert res["data"] is None and "not found" in res["error"]

    def test_fx_refresh_twice_same_day_one_row_per_currency(self, client, monkeypatch):
        from app.services import fx
        monkeypatch.setattr(fx, "fetch_realtime_fx_rates",
                            lambda: {"usdInr": 95.1, "eurInr": 110.2, "dateStr": "2026-10-30", "isFallback": False})
        rpc(client, "refresh_exchange_rates", {})
        data = rpc(client, "refresh_exchange_rates", {})
        assert set(data) == {"USD_INR", "EUR_INR"}
        assert data["USD_INR"]["rate"] == 95.1
        fx_rates = rpc(client, "get_fx_rates", {})
        assert [f["currency_pair"] for f in fx_rates] == ["USD_INR", "EUR_INR"]

    def test_calculate_costing_via_get_query_string(self, client):
        q = "&".join(f"{k}={v}" for k, v in REF.items())
        res = client.get(f"/api/rpc/calculate_costing?{q}").json()
        assert res["data"]["usd_price"] == pytest.approx(USD_PRICE_CHITTAGONG, abs=TOL)
