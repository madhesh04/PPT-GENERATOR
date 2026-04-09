import os
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import core and routers
from core.config import settings
from db.client import get_users_collection, get_presentations_collection, get_settings_collection
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
    # Startup: Ensure DB Indexes and default settings
    try:
        users_coll = get_users_collection()
        presentations_coll = get_presentations_collection()
        settings_coll = get_settings_collection()
        
        await users_coll.create_index("email", unique=True)
        await presentations_coll.create_index("content_hash")
        await presentations_coll.create_index("user_id")
        
        # Backfill status
        await users_coll.update_many(
            {"status": {"$exists": False}},
            {"$set": {"status": "active"}}
        )
        
        # Default global config
        global_settings = await settings_coll.find_one({"id": "global_config"})
        if not global_settings:
            await settings_coll.insert_one({
                "id": "global_config",
                "image_generation_enabled": True,
                "speaker_notes_enabled": True,
                "default_model": "groq"
            })
        
        logger.info("Lifespan: MongoDB indexes and settings verified.")
    except Exception as e:
        logger.warning(f"Lifespan: DB setup error (might be expected in some environments): {e}")
        
    yield
    # Shutdown logic (if any)
    logger.info("Lifespan: Shutting down.")

app = FastAPI(title="Skynet PPT Generator API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────
origins = [
    settings.frontend_url.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
# Allow dynamic origins from env if provided
env_origins = os.getenv("FRONTEND_URL", "")
if env_origins:
    origins.extend([o.strip().rstrip("/") for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# Fix for datetime in health route
from datetime import datetime

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
