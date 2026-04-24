"""
MCPAuthMiddleware — ASGI middleware that wraps the FastMCP app.

Validates the Bearer token in the Authorization header against the
`mcp_tokens` MongoDB collection, ensuring only active org users can
call MCP tools.

Usage in main.py:
    from core.mcp_auth import MCPAuthMiddleware
    app.mount("/mcp", MCPAuthMiddleware(mcp_app.streamable_http_app()))
"""

import json
import logging
from datetime import datetime, timezone
from typing import Callable

from db.client import get_mcp_tokens_collection

logger = logging.getLogger(__name__)


class MCPAuthMiddleware:
    """
    Lightweight ASGI middleware that gate-keeps the FastMCP ASGI application.

    - Passes through CORS preflight OPTIONS requests without auth.
    - Extracts Bearer token from Authorization header.
    - Looks up the token in mcp_tokens collection (active=True, not expired).
    - Injects mcp_user into the ASGI scope for downstream tool handlers.
    - Returns a JSON-RPC 2.0 error response on auth failure.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Pass through non-HTTP scopes (lifespan, websocket) and CORS preflights
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        method = scope.get("method", "")

        # Allow OPTIONS through for CORS preflight
        if method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # ── Extract Bearer token ──────────────────────────────────────────────
        auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")
        if not auth_header.startswith("Bearer "):
            await self._send_401(send, "Missing or invalid Authorization header")
            return

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            await self._send_401(send, "Empty token")
            return

        # ── Validate against MongoDB ──────────────────────────────────────────
        try:
            tokens_collection = get_mcp_tokens_collection()
            token_doc = await tokens_collection.find_one({"token": token, "active": True})
        except Exception as e:
            logger.error("MCP token DB lookup failed: %s", e)
            await self._send_500(send, "Authentication service unavailable")
            return

        if not token_doc:
            logger.warning("MCP auth: token not found or inactive")
            await self._send_401(send, "Invalid or revoked MCP token")
            return

        # ── Check expiry ──────────────────────────────────────────────────────
        expires_at = token_doc.get("expires_at")
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_at:
                logger.warning("MCP auth: expired token for user '%s'", token_doc.get("user_id"))
                await self._send_401(send, "MCP token has expired — re-authenticate via Claude connector settings")
                return

        # ── Inject user into scope for downstream tools ───────────────────────
        scope["mcp_user"] = {
            "user_id": token_doc["user_id"],
            "username": token_doc["username"],
            "role": token_doc["role"],
        }
        logger.debug("MCP auth: '%s' authenticated (role=%s)", token_doc["user_id"], token_doc["role"])

        await self.app(scope, receive, send)

    # ── Error response helpers ────────────────────────────────────────────────

    async def _send_401(self, send: Callable, detail: str):
        from core.config import settings
        
        body = json.dumps({
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32001, "message": f"Unauthorized: {detail}"},
        }).encode()
        
        # RFC 9728 compliant WWW-Authenticate header with resource parameter
        base = settings.backend_url.rstrip("/")
        metadata_url = f"{base}/.well-known/oauth-protected-resource/mcp"
        
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body)).encode()],
                [b"www-authenticate", f'Bearer realm="Skynet MCP", resource="{metadata_url}"'.encode()],
            ],
        })
        await send({"type": "http.response.body", "body": body})

    async def _send_500(self, send: Callable, detail: str):
        body = json.dumps({
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32603, "message": detail},
        }).encode()
        await send({
            "type": "http.response.start",
            "status": 500,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body)).encode()],
            ],
        })
        await send({"type": "http.response.body", "body": body})
