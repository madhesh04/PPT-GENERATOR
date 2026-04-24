import os
import sys

# Add the current directory to sys.path to resolve imports when running from root (Render)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Body, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from bson import ObjectId
from typing import Any, Optional

# Global MongoDB Serialization Fix — must be before router imports
ENCODERS_BY_TYPE[ObjectId] = str

from core.config import settings
from db.client import (
    connect_db, close_db,
    connect_timesheet_db, close_timesheet_db,
    get_presentations_collection, get_settings_collection,
    get_db, get_audit_logs_collection, get_bank_collection
)
from routers import auth, generate, admin, bank as bank_router
from mcp_server import mcp_app
from core.security import get_current_user_from_token

# ── MCP Token Store ────────────────────────────────────────────────────────────
VALID_MCP_TOKENS = set()  # In-memory store for MCP tokens

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
        await presentations_coll.create_index([("title", "text")])  # full-text search

        # Audit logs indexes
        audit_coll = get_audit_logs_collection()
        await audit_coll.create_index([("user_id", 1), ("timestamp", -1)])
        await audit_coll.create_index("content_id")

        # Bank indexes
        bank_coll = get_bank_collection()
        await bank_coll.create_index("created_by")

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
app.include_router(bank_router.router)

# ── MCP Token Generation ───────────────────────────────────────────────────────
@app.post("/mcp/token")
async def generate_mcp_token(request: Request):
    """Generate MCP token for authenticated users."""
    user = get_current_user_from_token(request)
    token = f"mcp-{user['user_id']}-{int(datetime.now(timezone.utc).timestamp())}"
    VALID_MCP_TOKENS.add(token)
    logger.info(f"MCP token generated for user: {user['user_id']}")
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 3600
    }

@app.post("/mcp/token/add")
async def add_mcp_token_manual(token: str = Body(..., embed=True)):
    """Manually add an MCP token (for testing)."""
    VALID_MCP_TOKENS.add(token)
    logger.info(f"MCP token manually added: {token}")
    return {"status": "ok", "message": f"Token added: {token}", "total_tokens": len(VALID_MCP_TOKENS)}

# ── MCP Server (direct FastAPI integration) ────────────────────────────────────
# Mount MCP tools as regular FastAPI routes for HTTP-based MCP clients

# Simple API key auth for MCP endpoint
MCP_API_KEY = os.getenv("MCP_API_KEY", "skynet-mcp-key-change-me")

# ── OAuth Discovery Endpoints (for Claude Web custom connector) ──────────────
@app.get("/.well-known/oauth-authorization-server")
async def oauth_authorization_server(request: Request):
    """OAuth 2.0 Authorization Server Metadata (RFC 8414)."""
    base_url = str(request.base_url).rstrip("/")
    return {
        "issuer": base_url,
        "token_endpoint": f"{base_url}/token",
        "registration_endpoint": f"{base_url}/register",
        "grant_types_supported": ["client_credentials"],
        "token_endpoint_auth_methods_supported": ["none"],
    }

@app.get("/.well-known/oauth-protected-resource")
async def oauth_protected_resource(request: Request):
    """OAuth 2.0 Protected Resource Metadata (RFC 8707)."""
    base_url = str(request.base_url).rstrip("/")
    return {
        "resource": base_url,
        "authorization_servers": [base_url],
    }

@app.post("/register")
async def oauth_register(request: Request):
    """OAuth 2.0 Dynamic Client Registration (RFC 7591)."""
    body = await request.json()
    # Accept any registration, return a dummy client
    return {
        "client_id": "skynet-mcp-client",
        "client_secret": "not-required",
        "client_id_issued_at": int(datetime.now(timezone.utc).timestamp()),
    }

@app.post("/token")
async def oauth_token():
    """OAuth 2.0 Token Endpoint - redirects to /mcp/token."""
    return {
        "access_token": "use-mcp-token-endpoint",
        "token_type": "Bearer",
        "expires_in": 3600,
        "message": "Use POST /mcp/token with your existing auth token to get MCP access"
    }

@app.get("/mcp")
async def mcp_health():
    """Health check endpoint for MCP server discovery."""
    return {
        "status": "ok",
        "protocol": "json-rpc-2.0",
        "server": "skynet-mcp",
        "version": "1.0.0"
    }

@app.post("/mcp")
async def mcp_endpoint(
    request: dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(None)
):
    """MCP JSON-RPC endpoint for tool calls with token-based auth."""
    # Verify MCP token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.replace("Bearer ", "")
    if token not in VALID_MCP_TOKENS:
        raise HTTPException(status_code=403, detail="Invalid MCP token. Generate one at POST /mcp/token")
    
    method = request.get("method")
    params = request.get("params", {})
    req_id = request.get("id", 1)
    
    if method == "tools/list":
        tools = [
            {"name": "generate_presentation", "description": "Generate a full presentation using the Skynet pipeline"},
            {"name": "export_presentation", "description": "Build a PPTX file from a previously generated presentation"},
            {"name": "create_presentation_from_content", "description": "Build a PPTX directly from pre-generated slide content"},
            {"name": "ingest_slide_content", "description": "Accept pre-generated slide content and feed it into the PPT pipeline"},
            {"name": "regenerate_slide", "description": "Generate a single replacement slide"},
            {"name": "get_presentation", "description": "Retrieve a saved presentation by token"},
            {"name": "list_presentations", "description": "List recently generated presentations"},
        ]
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": tools}}
    
    elif method == "tools/call":
        tool_name = params.get("name")
        args = params.get("arguments", {})
        
        # Import and call the actual MCP tool functions
        from mcp_server import (
            generate_presentation, export_presentation, create_presentation_from_content,
            ingest_slide_content, regenerate_slide, get_presentation, list_presentations
        )
        
        tool_map = {
            "generate_presentation": generate_presentation,
            "export_presentation": export_presentation,
            "create_presentation_from_content": create_presentation_from_content,
            "ingest_slide_content": ingest_slide_content,
            "regenerate_slide": regenerate_slide,
            "get_presentation": get_presentation,
            "list_presentations": list_presentations,
        }
        
        if tool_name in tool_map:
            import json
            result = await tool_map[tool_name](**args)
            return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": result}]}}
        else:
            return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Tool not found: {tool_name}"}}
    
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}


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
        "version": "1.2.0-PROD",
        "authorized_origins": settings.cors_origins
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
