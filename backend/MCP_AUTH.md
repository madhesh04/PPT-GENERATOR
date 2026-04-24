# MCP Authentication Flow

## Overview
MCP endpoints require token-based authentication. Only authenticated Skynet users can generate MCP tokens.

## Flow

### 1. User logs into Skynet (existing auth)
```bash
POST /auth/login
{
  "email": "employee_id",
  "password": "password",
  "login_as": "employee"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {...}
}
```

### 2. Generate MCP token
```bash
POST /mcp/token
Authorization: Bearer eyJhbGc...

Response:
{
  "access_token": "mcp-employee_id-1234567890",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 3. Use MCP token with Claude
Configure Claude custom connector with:
- **URL**: `https://your-ngrok-url.ngrok.io`
- **Token**: `mcp-employee_id-1234567890`

### 4. Claude calls MCP tools
```bash
POST /mcp
Authorization: Bearer mcp-employee_id-1234567890
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_presentation_from_content",
    "arguments": {...}
  }
}
```

## Important Notes

- MCP tokens are stored in-memory (cleared on server restart)
- No browser redirects or cookies
- All responses are JSON
- Token must be included in `Authorization: Bearer <token>` header
- OAuth discovery endpoints are minimal stubs for Claude compatibility

## Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/auth/login` | POST | No | Get Skynet JWT token |
| `/mcp/token` | POST | Yes (JWT) | Generate MCP token |
| `/mcp` | GET | No | Health check |
| `/mcp` | POST | Yes (MCP token) | Execute MCP tools |
| `/.well-known/oauth-authorization-server` | GET | No | OAuth discovery |
| `/.well-known/oauth-protected-resource` | GET | No | OAuth discovery |
| `/register` | POST | No | OAuth stub |
| `/token` | POST | No | OAuth stub (redirects to /mcp/token) |
