import os
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from bson import ObjectId

# Global MongoDB Serialization Fix — must be before router imports
ENCODERS_BY_TYPE[ObjectId] = str

from core.config import settings
from db.client import connect_db, close_db, get_users_collection, get_presentations_collection, get_settings_collection
from routers import auth, generate, admin

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["20/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect DB, create indexes, seed defaults
    try:
        await connect_db()
        
        users_coll = get_users_collection()
        presentations_coll = get_presentations_collection()
        settings_coll = get_settings_collection()
        
        await users_coll.create_index("email", unique=True)
        await presentations_coll.create_index("content_hash")
        await presentations_coll.create_index("user_id")
        
        # Backfill status for legacy records
        await users_coll.update_many(
            {"status": {"$exists": False}},
            {"$set": {"status": "active"}}
        )
        
        # Seed default global config
        global_settings = await settings_coll.find_one({"id": "global_config"})
        if not global_settings:
            await settings_coll.insert_one({
                "id": "global_config",
                "image_generation_enabled": True,
                "speaker_notes_enabled": True,
                "default_model": "groq"
            })
        
        logger.info("Lifespan: MongoDB connected, indexes and settings verified.")
    except Exception as e:
        logger.warning(f"Lifespan: DB setup error (might be expected in some environments): {e}")
        
    yield
    
    # Shutdown: close the Motor client cleanly
    await close_db()
    logger.info("Lifespan: Shutting down — DB connection closed.")


app = FastAPI(title="Skynet PPT Generator API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
