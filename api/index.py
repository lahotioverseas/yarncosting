"""Vercel serverless entry point: exposes the FastAPI app (backend/app) as one Python function.
vercel.json rewrites every /api/* request here; the React build is served as static files."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401
