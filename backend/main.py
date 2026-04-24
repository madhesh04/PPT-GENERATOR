import os
import sys

# Add the current directory to sys.path to resolve imports when running from root (Render)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

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
from db.client import (
    connect_db, close_db,
    connect_timesheet_db, close_timesheet_db,
    get_presentations_collection, get_settings_collection,
    get_db, get_audit_logs_collection, get_bank_collection,
    get_mcp_tokens_collection, get_mcp_auth_codes_collection,
)
from routers import auth, generate, admin, bank as bank_router
from routers.oauth import router as oauth_router
from mcp_server import mcp_app, _mcp_user_ctx
from core.mcp_auth import MCPAuthMiddleware

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
def get_real_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=get_real_ip, default_limits=["10/minute"])

# Initialize FastMCP ASGI app early so we can trigger its lifespan
_mcp_asgi = mcp_app.streamable_http_app()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect DBs, create indexes, seed defaults
    try:
        await connect_db()
        await connect_timesheet_db()

        presentations_coll = get_presentations_collection()
        settings_coll = get_settings_collection()

        # Indexes for Skynet app data
        await presentations_coll.create_index("content_hash")
        await presentations_coll.create_index("user_id")
        await presentations_coll.create_index([("title", "text")])

        # Audit logs indexes
        audit_coll = get_audit_logs_collection()
        await audit_coll.create_index([("user_id", 1), ("timestamp", -1)])
        await audit_coll.create_index("content_id")

        # Bank indexes
        bank_coll = get_bank_collection()
        await bank_coll.create_index("created_by")

        # MCP token indexes
        mcp_tokens_coll = get_mcp_tokens_collection()
        await mcp_tokens_coll.create_index("token", unique=True)
        await mcp_tokens_coll.create_index("user_id")
        await mcp_tokens_coll.create_index("expires_at")

        # MCP auth code indexes (TTL — auto-expire after 600s)
        mcp_codes_coll = get_mcp_auth_codes_collection()
        await mcp_codes_coll.create_index("code", unique=True)
        await mcp_codes_coll.create_index("expires_at", expireAfterSeconds=0)

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

    # Enter FastMCP lifespan (initializes the StreamableHTTP session manager task group)
    async with _mcp_asgi.router.lifespan_context(app):
        yield

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
app.include_router(bank_router.router)
app.include_router(oauth_router)      # GET/POST /oauth/authorize


# ── OAuth Discovery Endpoints (required by Claude custom connector) ───────────

@app.get("/.well-known/oauth-authorization-server")
async def oauth_authorization_server():
    """OAuth 2.0 Authorization Server Metadata (RFC 8414)."""
    base = settings.backend_url.rstrip("/")
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/token",
        "registration_endpoint": f"{base}/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256", "plain"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic", "none"],
        "scopes_supported": ["mcp"],
    }

@app.get("/.well-known/oauth-protected-resource")
@app.get("/.well-known/oauth-protected-resource/mcp")
async def oauth_protected_resource():
    """OAuth 2.0 Protected Resource Metadata (RFC 8707)."""
    base = settings.backend_url.rstrip("/")
    return {
        "resource": f"{base}/mcp",
        "authorization_servers": [base],
        "bearer_methods_supported": ["header"],
        "scopes_supported": ["mcp"],
    }

@app.post("/register")
async def oauth_register(request: Request):
    """OAuth 2.0 Dynamic Client Registration (RFC 7591)."""
    import secrets
    return {
        "client_id": "skynet-mcp-client",
        "client_secret": secrets.token_hex(16),
        "client_id_issued_at": int(datetime.now(timezone.utc).timestamp()),
        "client_secret_expires_at": 0,
        "token_endpoint_auth_method": "none",
    }


# ── MCP Server — FastMCP mounted with auth middleware ─────────────────────────
#
# The MCPAuthMiddleware:
#   1. Validates the Bearer token from Authorization header against mcp_tokens collection
#   2. Injects scope["mcp_user"] with the authenticated user identity
#
# We wrap the FastMCP ASGI app so every MCP tool call is authenticated.
# The token endpoint is at POST /token (handled by oauth_router above).

class _MCPContextMiddleware(MCPAuthMiddleware):
    """
    Extends MCPAuthMiddleware to also set the _mcp_user_ctx ContextVar
    so MCP tool functions can read the authenticated user via _get_mcp_user().
    """
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            method = scope.get("method", "")
            auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")

            if method != "OPTIONS" and auth_header.startswith("Bearer "):
                # Run the parent validation first (sets scope["mcp_user"] or rejects)
                # We delegate but capture whether validation succeeded by checking scope after
                token = auth_header.removeprefix("Bearer ").strip()
                if token:
                    try:
                        from db.client import get_mcp_tokens_collection as _get_tok
                        from datetime import datetime, timezone as _tz
                        tokens_collection = _get_tok()
                        token_doc = await tokens_collection.find_one({"token": token, "active": True})
                        if token_doc:
                            expires_at = token_doc.get("expires_at")
                            if expires_at:
                                if expires_at.tzinfo is None:
                                    expires_at = expires_at.replace(tzinfo=_tz.utc)
                                if datetime.now(_tz.utc) <= expires_at:
                                    mcp_user = {
                                        "user_id": token_doc["user_id"],
                                        "username": token_doc["username"],
                                        "role": token_doc["role"],
                                    }
                                    token_ctx = _mcp_user_ctx.set(mcp_user)
                                    try:
                                        await super().__call__(scope, receive, send)
                                        return
                                    finally:
                                        _mcp_user_ctx.reset(token_ctx)
                    except Exception:
                        pass

        await super().__call__(scope, receive, send)


# Build and wire the authenticated MCP ASGI app
_authed_mcp = _MCPContextMiddleware(_mcp_asgi)

# Use add_route instead of mount to prevent 307 redirects to /mcp/
app.add_route("/mcp", _authed_mcp, methods=["GET", "POST", "OPTIONS"])


# ── MCP Health (GET /mcp is shadowed by mount; serve a plain redirect) ─────────
# Note: The mount at /mcp handles all requests including GET. FastMCP serves
# its own GET endpoint for SSE. Add a health endpoint at a different path.

@app.get("/mcp-health")
async def mcp_health():
    """Health check for MCP server (the /mcp path is handled by FastMCP mount)."""
    return {
        "status": "ok",
        "protocol": "mcp-streamable-http",
        "server": "skynet-mcp",
        "version": "2.0.0",
        "auth": "oauth2-authorization-code",
        "connect_url": f"{settings.backend_url.rstrip('/')}/mcp",
    }


# ── Standard API health / root ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    try:
        await get_db().command("ping")
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/")
async def root():
    return {
        "name": "Skynet Core API",
        "status": "operational",
        "version": "2.0.0-MCP",
        "authorized_origins": settings.cors_origins,
        "mcp_endpoint": f"{settings.backend_url.rstrip('/')}/mcp",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
