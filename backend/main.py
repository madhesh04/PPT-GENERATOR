import os
import sys
from pathlib import Path

# Add the current directory to sys.path to resolve imports when running from root (Render)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from bson import ObjectId

# Global MongoDB Serialization Fix — must be before router imports
ENCODERS_BY_TYPE[ObjectId] = str

from core.config import settings
from db.client import (
    connect_db, close_db,
    connect_timesheet_db, close_timesheet_db,
    get_presentations_collection, get_settings_collection
)
from routers import auth, generate, admin

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect DBs, create indexes, seed defaults
    try:
        # Connect to both databases
        await connect_db()
        await connect_timesheet_db()

        presentations_coll = get_presentations_collection()
        settings_coll = get_settings_collection()

        # Indexes for Skynet app data only (do NOT touch external Timesheet DB)
        await presentations_coll.create_index("content_hash")
        await presentations_coll.create_index("user_id")

        # Seed default global config
        global_settings = await settings_coll.find_one({"id": "global_config"})
        if not global_settings:
            await settings_coll.insert_one({
                "id": "global_config",
                "image_generation_enabled": True,
                "speaker_notes_enabled": True,
                "default_model": "groq"
            })

        logger.info("Lifespan: Skynet DB + Timesheet DB connected, indexes and settings verified.")
    except Exception as e:
        logger.warning(f"Lifespan: DB setup error (might be expected in some environments): {e}")

    yield

    # Shutdown: close both Motor clients cleanly
    await close_db()
    await close_timesheet_db()
    logger.info("Lifespan: Shutting down — all DB connections closed.")


app = FastAPI(title="Skynet PPT Generator API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/")
async def root():
    return {
        "name": "Skynet Core API",
        "status": "operational",
        "version": "1.2.0-PROD",
        "authorized_origins": settings.cors_origins
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
