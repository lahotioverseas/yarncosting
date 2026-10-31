"""Small helpers that reproduce JavaScript semantics the original TypeScript
backend relied on (Number(), toFixed(), parseFloat(), truthiness, division by
zero, Date.now()). Keeping these exact means the ported costing maths and sheet
parsing give the same numbers as before."""
from __future__ import annotations

import math
import random
import re
import string
import time
from datetime import datetime, timezone
from decimal import ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal
from typing import Any


class _Undefined:
    """Sentinel for a missing key (JS `undefined`), distinct from None (JS `null`)."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __bool__(self) -> bool:
        return False

    def __repr__(self) -> str:
        return "undefined"


UNDEFINED = _Undefined()
NAN = float("nan")

_NUMERIC_RE = re.compile(r"^[+-]?(\d+\.?\d*(e[+-]?\d+)?|\.\d+(e[+-]?\d+)?|infinity)$", re.IGNORECASE)
_HEX_RE = re.compile(r"^0x[0-9a-f]+$", re.IGNORECASE)
_PARSE_FLOAT_RE = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")
_JS_WS = " \t\n\r\x0b\x0c                 　﻿"


def get(obj: Any, key: str) -> Any:
    """obj[key] with JS semantics: missing key -> UNDEFINED."""
    if isinstance(obj, dict):
        return obj.get(key, UNDEFINED)
    return UNDEFINED


def is_nullish(v: Any) -> bool:
    return v is None or v is UNDEFINED


def nullish(v: Any, default: Any) -> Any:
    """JS `v ?? default`."""
    return default if is_nullish(v) else v


def truthy(v: Any) -> bool:
    if v is None or v is UNDEFINED or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return not (v == 0 or (isinstance(v, float) and math.isnan(v)))
    if isinstance(v, str):
        return v != ""
    return True


def js_or(*values: Any) -> Any:
    """JS `a || b || c`."""
    for v in values[:-1]:
        if truthy(v):
            return v
    return values[-1]


def js_trim(s: str) -> str:
    return s.strip(_JS_WS)


def js_number(v: Any) -> float:
    """JS Number(v)."""
    if v is UNDEFINED:
        return NAN
    if v is None or v is False:
        return 0.0
    if v is True:
        return 1.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = js_trim(v)
        if s == "":
            return 0.0
        if _HEX_RE.match(s):
            return float(int(s, 16))
        if _NUMERIC_RE.match(s):
            return float(s)
        return NAN
    if isinstance(v, list):
        if len(v) == 0:
            return 0.0
        if len(v) == 1:
            return js_number(v[0] if not isinstance(v[0], list) else js_string(v[0]))
        return NAN
    return NAN


def is_nan(v: Any) -> bool:
    """JS global isNaN(v) (coerces with Number())."""
    n = js_number(v)
    return math.isnan(n)


def js_parse_float(s: Any) -> float:
    if is_nullish(s):
        return NAN
    m = _PARSE_FLOAT_RE.match(js_trim(js_string(s)))
    if not m:
        return NAN
    return float(m.group(0))


def js_string(v: Any) -> str:
    """JS String(v) for the value kinds this app handles."""
    if v is UNDEFINED:
        return "undefined"
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, float):
        if math.isnan(v):
            return "NaN"
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
        if v.is_integer() and abs(v) < 1e21:
            return str(int(v))
        r = repr(v)
        if "e" in r:
            mant, exp = r.split("e")
            exp_i = int(exp)
            return f"{mant}e{'+' if exp_i > 0 else '-'}{abs(exp_i)}"
        return r
    if isinstance(v, int):
        return str(v)
    if isinstance(v, list):
        return ",".join("" if is_nullish(x) else js_string(x) for x in v)
    if isinstance(v, dict):
        return "[object Object]"
    return str(v)


def to_fixed_str(x: float, digits: int) -> str:
    """JS Number.prototype.toFixed: ties resolve toward +infinity."""
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    quant = Decimal(1).scaleb(-digits)
    mode = ROUND_HALF_UP if x >= 0 else ROUND_HALF_DOWN
    d = Decimal(x).quantize(quant, rounding=mode)
    out = f"{d:.{digits}f}"
    if out.startswith("-") and float(d) == 0:
        out = out[1:]
    return out


def to_fixed(x: float, digits: int) -> float:
    """Number(x.toFixed(digits))."""
    if math.isnan(x) or math.isinf(x):
        return x
    return float(to_fixed_str(x, digits))


def js_round(x: float) -> float:
    """Math.round."""
    if math.isnan(x) or math.isinf(x):
        return x
    return float(math.floor(x + 0.5))


def div(a: float, b: float) -> float:
    """JS division (x/0 -> +-Infinity, 0/0 -> NaN)."""
    try:
        return a / b
    except ZeroDivisionError:
        if a == 0 or math.isnan(a):
            return NAN
        sign = math.copysign(1.0, a) * math.copysign(1.0, b)
        return math.inf if sign > 0 else -math.inf


def now_ms() -> int:
    return int(time.time() * 1000)


def iso_now() -> str:
    """new Date().toISOString()."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def utc_date_str() -> str:
    """new Date().toISOString().split('T')[0]."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def to_base36(n: int) -> str:
    chars = string.digits + string.ascii_lowercase
    if n == 0:
        return "0"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = chars[r] + out
    return out


def random_base36(length: int = 4) -> str:
    """Math.random().toString(36).slice(2, 2 + length)."""
    chars = string.digits + string.ascii_lowercase
    return "".join(random.choice(chars) for _ in range(length))


def lower_trim(v: Any) -> str:
    """String(v || '').trim().toLowerCase()"""
    return js_trim(js_string(v) if truthy(v) else "").lower()


def format_en_us_2(x: float) -> str:
    """toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})"""
    return f"{to_fixed(x, 2):,.2f}"


def format_en_in(x: float) -> str:
    """toLocaleString('en-IN') with default max 3 fraction digits (Indian digit grouping)."""
    s = to_fixed_str(x, 3).rstrip("0").rstrip(".")
    neg = s.startswith("-")
    if neg:
        s = s[1:]
    int_part, _, frac = s.partition(".")
    if len(int_part) > 3:
        head, tail = int_part[:-3], int_part[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        int_part = ",".join(groups + [tail])
    return ("-" if neg else "") + int_part + (("." + frac) if frac else "")
