"""Live FX rates (USD/INR, EUR/INR) with three providers and a hard fallback.
Port of fetchRealtimeFxRates / exchangeRatesStore from rpcHandlers.ts."""
from __future__ import annotations

import logging
import threading
import time
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from .jsutil import iso_now, to_fixed, utc_date_str

log = logging.getLogger(__name__)

FALLBACK_USD_INR = 95.43
FALLBACK_EUR_INR = 111.36
_TIMEOUT = httpx.Timeout(6.0)

_lock = threading.Lock()
_last_refresh: float | None = None  # monotonic time of the last refresh in THIS process
FRESH_FOR_SECONDS = 10 * 60
FALLBACK_RETRY_SECONDS = 60

# Daily FX store used by the costing RPCs (exchangeRatesStore)
exchange_rates_store: dict[str, dict[str, Any]] = {
    "USD": {"rate": FALLBACK_USD_INR, "rate_date": utc_date_str(), "is_fallback": False},
    "EUR": {"rate": FALLBACK_EUR_INR, "rate_date": utc_date_str(), "is_fallback": False},
}


def _master_rate(pair: str, rate: float) -> dict[str, Any]:
    return {
        "currency_pair": pair,
        "rate": rate,
        "fx_buffer_margin": 0.0,
        "effective_rate": rate,
        "last_updated_at": iso_now(),
    }


# Master-data FX list shown in the header (fxRates in server-app.ts)
fx_rates_master: list[dict[str, Any]] = [
    _master_rate("USD_INR", FALLBACK_USD_INR),
    _master_rate("EUR_INR", FALLBACK_EUR_INR),
]


def fetch_realtime_fx_rates() -> dict[str, Any]:
    today = utc_date_str()

    # Strategy 1: open.er-api.com
    try:
        res = httpx.get("https://open.er-api.com/v6/latest/USD", timeout=_TIMEOUT)
        if res.status_code < 400:
            data = res.json()
            rates = (data or {}).get("rates") or {}
            if rates.get("INR"):
                usd_inr = to_fixed(float(rates["INR"]), 2)
                eur_inr = (
                    to_fixed(float(rates["INR"]) / float(rates["EUR"]), 2)
                    if rates.get("EUR")
                    else to_fixed(usd_inr * 1.167, 2)
                )
                date_str = today
                if data.get("time_last_update_utc"):
                    try:
                        date_str = parsedate_to_datetime(data["time_last_update_utc"]).strftime("%Y-%m-%d")
                    except Exception:
                        date_str = today
                return {"usdInr": usd_inr, "eurInr": eur_inr, "dateStr": date_str, "isFallback": False}
    except Exception as e:
        log.warning("FX Provider 1 (open.er-api) failed, trying fallback... %s", e)

    # Strategy 2: Frankfurter API (ECB reference rates)
    try:
        usd_res = httpx.get("https://api.frankfurter.app/latest?from=USD&to=INR", timeout=_TIMEOUT).json()
        eur_res = httpx.get("https://api.frankfurter.app/latest?from=EUR&to=INR", timeout=_TIMEOUT).json()
        usd_rate = to_fixed(float(usd_res["rates"]["INR"]), 2) if (usd_res or {}).get("rates", {}).get("INR") else None
        eur_rate = to_fixed(float(eur_res["rates"]["INR"]), 2) if (eur_res or {}).get("rates", {}).get("INR") else None
        if usd_rate and eur_rate:
            return {"usdInr": usd_rate, "eurInr": eur_rate, "dateStr": usd_res.get("date") or today, "isFallback": False}
    except Exception as e:
        log.warning("FX Provider 2 (frankfurter) failed, trying fallback... %s", e)

    # Strategy 3: exchangerate-api.com
    try:
        res = httpx.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=_TIMEOUT)
        if res.status_code < 400:
            data = res.json()
            rates = (data or {}).get("rates") or {}
            if rates.get("INR"):
                usd_inr = to_fixed(float(rates["INR"]), 2)
                eur_inr = (
                    to_fixed(float(rates["INR"]) / float(rates["EUR"]), 2)
                    if rates.get("EUR")
                    else to_fixed(usd_inr * 1.167, 2)
                )
                return {"usdInr": usd_inr, "eurInr": eur_inr, "dateStr": data.get("date") or today, "isFallback": False}
    except Exception as e:
        log.warning("FX Provider 3 (exchangerate-api) failed %s", e)

    return {"usdInr": FALLBACK_USD_INR, "eurInr": FALLBACK_EUR_INR, "dateStr": today, "isFallback": True}


def get_exchange_rates() -> dict[str, Any]:
    return {"USD_INR": exchange_rates_store["USD"], "EUR_INR": exchange_rates_store["EUR"]}


def refresh_exchange_rates() -> dict[str, Any]:
    """handleRefreshExchangeRates: fetch live rates and update both FX stores."""
    global _last_refresh
    rates = fetch_realtime_fx_rates()
    with _lock:
        # a provider outage (fallback rates) is retried sooner
        _last_refresh = time.monotonic() - (FRESH_FOR_SECONDS - FALLBACK_RETRY_SECONDS if rates["isFallback"] else 0)
        exchange_rates_store["USD"] = {"rate": rates["usdInr"], "rate_date": rates["dateStr"], "is_fallback": rates["isFallback"]}
        exchange_rates_store["EUR"] = {"rate": rates["eurInr"], "rate_date": rates["dateStr"], "is_fallback": rates["isFallback"]}
        fx_rates_master[:] = [
            _master_rate("USD_INR", rates["usdInr"]),
            _master_rate("EUR_INR", rates["eurInr"]),
        ]
    return get_exchange_rates()


def ensure_fresh() -> None:
    """Refresh live FX if this process has none or they are older than 10 minutes.
    Needed on Vercel: every serverless instance starts with only the fallback rates."""
    if _last_refresh is None or time.monotonic() - _last_refresh > FRESH_FOR_SECONDS:
        try:
            refresh_exchange_rates()
        except Exception as e:
            log.warning("FX refresh failed, using last known rates: %s", e)
