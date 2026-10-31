"""India Standard Time helpers. IST is a fixed UTC+05:30 offset (no DST), so a
fixed tzinfo is exact and avoids depending on a tz database (missing on Windows)."""
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def now_ist() -> datetime:
    return datetime.now(IST)


def today_ist() -> str:
    """Current IST calendar date as YYYY-MM-DD. Prices lock when this rolls over at 00:00 IST."""
    return now_ist().strftime("%Y-%m-%d")


def next_midnight_ist() -> datetime:
    now = now_ist()
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def seconds_until_midnight_ist() -> float:
    return max(1.0, (next_midnight_ist() - now_ist()).total_seconds())
