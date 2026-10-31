"""Runtime configuration: environment variables and file locations."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent

# .env may live at the project root (as before) or inside backend/
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")

SEED_DIR = Path(__file__).resolve().parent / "seed"

# Running as a Vercel serverless function (Vercel sets VERCEL=1). The deployment is read-only
# except /tmp, and /tmp is wiped between cold starts, so MongoDB is the real storage there.
IS_VERCEL = bool(os.environ.get("VERCEL"))

# Runtime state / local fallback (pricing store, history, Zoho caches).
_default_data_dir = Path("/tmp/yarn-costing") if IS_VERCEL else (BACKEND_DIR / "storage")
DATA_DIR = Path(os.environ.get("DATA_DIR") or _default_data_dir).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Built React app served by FastAPI in production (npm run build in frontend/)
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST") or (PROJECT_DIR / "frontend" / "dist")).resolve()

IST_TIMEZONE = "Asia/Kolkata"


def env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# Set MONGODB_ENABLED=false to force local-file storage (used by the test suite).
MONGODB_ENABLED = env_flag("MONGODB_ENABLED", True)
