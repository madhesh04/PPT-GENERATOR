"""
OAuth 2.0 Authorization Code flow for the Skynet MCP Claude custom connector.

Endpoints:
  GET  /oauth/authorize   — renders the Skynet-branded HTML login form
  POST /oauth/authorize   — validates credentials against Timesheet DB,
                            issues auth code, redirects to Claude redirect_uri
  POST /token             — exchanges auth code for a persistent MCP access token
"""

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urljoin

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from core.config import settings
from core.security import verify_password
from db.client import (
    get_mcp_auth_codes_collection,
    get_mcp_tokens_collection,
    get_timesheet_users_collection,
)

router = APIRouter(tags=["oauth"])
logger = logging.getLogger(__name__)

# ─── HTML login page — exact Skynet visual identity ──────────────────────────

def _login_html(
    redirect_uri: str,
    client_id: str,
    state: str,
    scope: str,
    error: str = "",
    mode: str = "employee",
) -> str:
    error_block = (
        f'<div class="lc-error"><span>⚠ </span>{error}</div>' if error else ""
    )
    admin_class = "mode-admin" if mode == "admin" else ""
    session_label = "ADMIN_OVERRIDE" if mode == "admin" else "SESSION_INIT"
    awaiting_label = "ADMIN_OVERRIDE_CL" if mode == "admin" else "AWAITING_CREDENTIALS"
    id_label = "MANAGER_ID" if mode == "admin" else "EMPLOYEE_ID"
    employee_active = "active" if mode == "employee" else ""
    admin_active = "active" if mode == "admin" else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Skynet — Connect Claude</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{
      --font:  'Nunito', sans-serif;
      --mono:  'JetBrains Mono', monospace;
      --accent: #0325BD;
      --accent-hi: #1530c4;
      --green: #22d3a5;
      --red:   #ef4444;
    }}
    html, body {{
      height: 100%; background: #0d0f14;
      color: #f0f2f8; font-family: var(--font);
      font-size: 14px; -webkit-font-smoothing: antialiased;
    }}
    @keyframes fadeUp {{
      from {{ opacity: 0; transform: translateY(8px); }}
      to   {{ opacity: 1; transform: translateY(0); }}
    }}
    @keyframes logo-pulse {{
      0%,100% {{ box-shadow: 0 0 12px rgba(3,37,189,0.3); }}
      50%      {{ box-shadow: 0 0 24px rgba(3,37,189,0.55); }}
    }}
    @keyframes btn-pulse {{
      0%,100% {{ box-shadow: 0 4px 20px rgba(3,37,189,0.4), 0 0 0 0 rgba(3,37,189,0.25); }}
      50%     {{ box-shadow: 0 6px 30px rgba(3,37,189,0.55), 0 0 0 7px rgba(3,37,189,0); }}
    }}
    @keyframes spinning {{ to {{ transform: rotate(360deg); }} }}
    @keyframes blink {{ 50% {{ opacity: 0.4; }} }}

    .page-wrap {{
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 24px;
    }}

    /* Connector badge */
    .connector-badge {{
      display: flex; align-items: center; gap: 10px;
      background: rgba(3,37,189,0.08); border: 1px solid rgba(3,37,189,0.25);
      border-radius: 99px; padding: 8px 18px;
      margin-bottom: 28px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      color: #d1d1f1; font-family: var(--mono);
      animation: fadeUp 0.3s ease both;
    }}
    .connector-badge .dot {{
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--green); box-shadow: 0 0 6px var(--green);
      animation: blink 2s ease-in-out infinite;
    }}

    /* Login card */
    .lc-card {{
      width: 100%; max-width: 440px;
      background: #13161e;
      border-radius: 14px;
      padding: 32px 36px 28px;
      border: 1px solid rgba(37,40,54,0.9);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 32px 80px rgba(0,0,0,0.6);
      animation: fadeUp 0.35s ease both;
    }}
    .lc-header {{ margin-bottom: 24px; }}
    .lc-session-tag {{
      display: flex; align-items: center; gap: 8px;
      font-family: var(--mono); font-size: 10px; font-weight: 600;
      letter-spacing: 0.12em; color: #4a5068;
      text-transform: uppercase; margin-bottom: 10px;
    }}
    .lc-dash {{
      display: inline-block; width: 20px; height: 2px;
      background: #4a5068; border-radius: 2px; flex-shrink: 0;
    }}
    .lc-title {{
      font-size: 26px; font-weight: 800;
      color: #f0f2f8; letter-spacing: -0.03em; margin-bottom: 6px;
    }}
    .lc-awaiting {{
      font-family: var(--mono); font-size: 11px; font-weight: 600;
      color: #22d3a5; letter-spacing: 0.06em;
    }}
    .lc-tabs {{
      display: flex; gap: 0; margin-bottom: 24px;
      background: #0d0f14; border-radius: 99px;
      border: 1px solid rgba(37,40,54,0.9); padding: 4px;
    }}
    .lc-tab {{
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
      padding: 10px 0; border-radius: 99px; border: none; cursor: pointer;
      font-size: 12px; font-weight: 700; letter-spacing: 0.04em;
      font-family: var(--font); color: #4a5068; background: transparent;
      transition: all 0.2s ease; text-decoration: none;
    }}
    .lc-tab svg {{ width: 16px; height: 16px; flex-shrink: 0; }}
    .lc-tab.active {{ background: #1a1d27; color: #f0f2f8; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }}
    .lc-tab:not(.active):hover {{ color: #8892b0; }}
    .lc-form {{ display: flex; flex-direction: column; gap: 18px; }}
    .lc-error {{
      background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
      border-radius: 12px; padding: 10px 14px;
      font-size: 12px; font-weight: 600; color: #ef4444;
    }}
    .lc-field {{ display: flex; flex-direction: column; gap: 7px; }}
    .lc-label {{
      font-family: var(--mono); font-size: 10px; font-weight: 700;
      letter-spacing: 0.14em; text-transform: uppercase; color: #4a5068;
    }}
    .lc-input-wrap {{
      display: flex; align-items: center; background: #0d0f14;
      border: 1px solid rgba(37,40,54,0.9); border-radius: 99px;
      transition: border-color 0.2s, box-shadow 0.2s; overflow: hidden;
    }}
    .lc-input-wrap:focus-within {{
      border-color: rgba(3,37,189,0.5); box-shadow: 0 0 0 3px rgba(3,37,189,0.1);
    }}
    .lc-icon {{ padding: 0 12px 0 18px; color: #4a5068; flex-shrink: 0; display: flex; align-items: center; }}
    .lc-icon svg {{ width: 16px; height: 16px; }}
    .lc-input {{
      flex: 1; min-width: 0; background: transparent !important; border: none; outline: none;
      padding: 14px 18px 14px 0; font-family: var(--font); font-size: 13px; color: #f0f2f8 !important;
    }}
    .lc-input::placeholder {{ color: #4a5068; }}
    .lc-input:-webkit-autofill,
    .lc-input:-webkit-autofill:hover,
    .lc-input:-webkit-autofill:focus {{
      -webkit-box-shadow: 0 0 0 1000px #0d0f14 inset !important;
      -webkit-text-fill-color: #f0f2f8 !important;
      transition: background-color 5000s ease-in-out 0s;
    }}
    .lc-btn {{
      width: 100%; padding: 14px; background: #0325BD;
      border: none; border-radius: 99px; color: #fff; cursor: pointer;
      font-family: var(--mono); font-size: 12px; font-weight: 800;
      letter-spacing: 0.12em; text-transform: uppercase;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.2s ease; margin-top: 4px;
    }}
    .lc-btn:hover:not(:disabled) {{
      background: #1530c4; box-shadow: 0 6px 24px rgba(3,37,189,0.45);
      transform: translateY(-1px);
    }}
    .lc-btn:disabled {{ opacity: 0.65; cursor: not-allowed; transform: none; }}
    .lc-hint {{
      margin-top: 18px; font-size: 12px; color: #4a5068; text-align: center;
    }}
    .lc-hint-link {{
      background: none; border: none; cursor: pointer; color: #0325BD;
      font-size: 12px; font-weight: 700; padding: 0;
      font-family: var(--font); transition: color 0.2s; text-decoration: none;
    }}
    .lc-hint-link:hover {{ color: #1530c4; }}

    /* Admin mode overrides */
    .mode-admin .lc-dash {{ background: #ef4444; }}
    .mode-admin .lc-session-tag {{ color: #ef4444; }}
    .mode-admin .lc-awaiting {{ color: #ef4444; }}
    .mode-admin .lc-tab.active {{ background: #810808; color: #fff; box-shadow: 0 2px 12px rgba(239,68,68,0.2); }}
    .mode-admin .lc-btn {{ background: #810808; }}
    .mode-admin .lc-btn:hover:not(:disabled) {{ background: #a50a0a; box-shadow: 0 6px 24px rgba(239,68,68,0.4); }}
    .mode-admin .lc-input-wrap:focus-within {{ border-color: rgba(239,68,68,0.5); box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }}
    .mode-admin .lc-hint-link {{ color: #ef4444; }}
    .mode-admin .lc-hint-link:hover {{ color: #f87171; }}

    .footer-note {{
      margin-top: 20px; text-align: center;
      font-family: var(--mono); font-size: 10px; color: #2a2d3a;
      letter-spacing: 0.06em;
    }}
  </style>
</head>
<body>
  <div class="page-wrap">
    <!-- Connection badge -->
    <div class="connector-badge">
      <span class="dot"></span>
      CONNECTING CLAUDE TO SKYNET MCP
    </div>

    <!-- Login card -->
    <div class="lc-card {admin_class}">
      <div class="lc-header">
        <div class="lc-session-tag">
          <span class="lc-dash"></span>
          {session_label}
        </div>
        <h1 class="lc-title">Skynet Application</h1>
        <div class="lc-awaiting">&gt;_ {awaiting_label}</div>
      </div>

      <!-- Tab switcher -->
      <div class="lc-tabs">
        <a class="lc-tab {employee_active}"
           href="/oauth/authorize?redirect_uri={redirect_uri}&client_id={client_id}&state={state}&scope={scope}&mode=employee">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Employee
        </a>
        <a class="lc-tab {admin_active}"
           href="/oauth/authorize?redirect_uri={redirect_uri}&client_id={client_id}&state={state}&scope={scope}&mode=admin">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
          </svg>
          Admin
        </a>
      </div>

      <!-- Form -->
      <form class="lc-form" method="POST" action="/oauth/authorize" autocomplete="off">
        <input type="hidden" name="redirect_uri" value="{redirect_uri}" />
        <input type="hidden" name="client_id"    value="{client_id}" />
        <input type="hidden" name="state"        value="{state}" />
        <input type="hidden" name="scope"        value="{scope}" />
        <input type="hidden" name="mode"         value="{mode}" />

        {error_block}

        <!-- Employee / Manager ID -->
        <div class="lc-field">
          <label class="lc-label" for="employee_id">{id_label}</label>
          <div class="lc-input-wrap">
            <span class="lc-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
              </svg>
            </span>
            <input id="employee_id" class="lc-input" type="text" name="employee_id"
              placeholder="User Identifier" autofocus autocomplete="username" required />
          </div>
        </div>

        <!-- Password -->
        <div class="lc-field">
          <label class="lc-label" for="password">PASSWORD</label>
          <div class="lc-input-wrap">
            <span class="lc-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
              </svg>
            </span>
            <input id="password" class="lc-input" type="password" name="password"
              placeholder="••••••••" autocomplete="current-password" required />
          </div>
        </div>

        <button type="submit" class="lc-btn">AUTHENTICATE</button>
      </form>

      <div class="lc-hint">
        {"Are you an admin?&nbsp;<a class=\"lc-hint-link\" href=\"/oauth/authorize?redirect_uri=" + redirect_uri + "&client_id=" + client_id + "&state=" + state + "&scope=" + scope + "&mode=admin\">Admin Login →</a>" if mode == "employee" else "Are you an employee?&nbsp;<a class=\"lc-hint-link\" href=\"/oauth/authorize?redirect_uri=" + redirect_uri + "&client_id=" + client_id + "&state=" + state + "&scope=" + scope + "&mode=employee\">Employee Login →</a>"}
      </div>
    </div>

    <p class="footer-note">SKYNET_MCP // ORG_AUTH_REQUIRED // v1.0</p>
  </div>
</body>
</html>"""


# ─── GET /oauth/authorize — serve the login form ──────────────────────────────

@router.get("/oauth/authorize", response_class=HTMLResponse)
async def oauth_authorize_get(
    redirect_uri: str = "",
    client_id: str = "skynet-mcp-client",
    state: str = "",
    scope: str = "mcp",
    response_type: str = "code",
    mode: str = "employee",
):
    return HTMLResponse(_login_html(
        redirect_uri=redirect_uri,
        client_id=client_id,
        state=state,
        scope=scope,
        mode=mode,
    ))


# ─── POST /oauth/authorize — validate creds, issue code, redirect ─────────────

@router.post("/oauth/authorize")
async def oauth_authorize_post(
    employee_id: str = Form(...),
    password: str = Form(...),
    redirect_uri: str = Form(...),
    client_id: str = Form(default="skynet-mcp-client"),
    state: str = Form(default=""),
    scope: str = Form(default="mcp"),
    mode: str = Form(default="employee"),
):
    users_collection = get_timesheet_users_collection()
    auth_codes_collection = get_mcp_auth_codes_collection()

    # ── Look up user in Timesheet DB ─────────────────────────────────────────
    user = await users_collection.find_one({"employeeId": employee_id.strip()})
    if not user:
        logger.warning("MCP OAuth: employeeId '%s' not found", employee_id)
        return HTMLResponse(_login_html(
            redirect_uri=redirect_uri, client_id=client_id, state=state, scope=scope,
            error="Authentication failed — invalid credentials.", mode=mode,
        ), status_code=401)

    # ── Verify password ───────────────────────────────────────────────────────
    if not verify_password(password, user["password"]):
        logger.warning("MCP OAuth: bad password for '%s'", employee_id)
        return HTMLResponse(_login_html(
            redirect_uri=redirect_uri, client_id=client_id, state=state, scope=scope,
            error="Authentication failed — invalid credentials.", mode=mode,
        ), status_code=401)

    # ── Role enforcement (same logic as /auth/login) ──────────────────────────
    db_role = user.get("role", "user").strip().lower()
    claimed_role = "user" if mode == "employee" else mode

    is_authorized = False
    if claimed_role == "user":
        is_authorized = db_role != "admin"
    elif claimed_role == "admin":
        is_authorized = db_role == "admin"

    if not is_authorized:
        logger.warning("MCP OAuth: role mismatch for '%s' (claimed=%s, db=%s)", employee_id, claimed_role, db_role)
        return HTMLResponse(_login_html(
            redirect_uri=redirect_uri, client_id=client_id, state=state, scope=scope,
            error=f"Access denied — your role ({db_role.upper()}) cannot use the {mode.upper()} portal.",
            mode=mode,
        ), status_code=403)

    # ── Issue a single-use auth code (TTL: 10 minutes) ───────────────────────
    code = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    frontend_role = "ADMIN" if db_role == "admin" else "USER"

    await auth_codes_collection.insert_one({
        "code": code,
        "user_id": employee_id.strip(),
        "username": user.get("name", employee_id.strip()),
        "role": frontend_role,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "created_at": now,
        "expires_at": now + timedelta(minutes=10),
        "used": False,
    })

    logger.info("MCP OAuth: auth code issued for '%s' (role=%s)", employee_id, frontend_role)

    # ── Redirect back to Claude with code + state ─────────────────────────────
    params = {"code": code}
    if state:
        params["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(
        url=f"{redirect_uri}{sep}{urlencode(params)}",
        status_code=302,
    )


# ─── POST /token — exchange auth code for access token ───────────────────────

@router.post("/token")
async def oauth_token(request: Request):
    """
    OAuth 2.0 token endpoint — supports authorization_code grant.
    Accepts both JSON and application/x-www-form-urlencoded bodies.
    """
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
    else:
        form = await request.form()
        body = dict(form)

    grant_type   = body.get("grant_type", "")
    code         = body.get("code", "")
    redirect_uri = body.get("redirect_uri", "")
    client_id    = body.get("client_id", "skynet-mcp-client")

    # ── client_credentials fallback (Claude may probe this) ──────────────────
    if grant_type == "client_credentials":
        return JSONResponse({
            "error": "invalid_grant",
            "error_description": "Use authorization_code grant via /oauth/authorize",
        }, status_code=400)

    if grant_type != "authorization_code" or not code:
        return JSONResponse({
            "error": "invalid_request",
            "error_description": "grant_type must be authorization_code and code must be provided",
        }, status_code=400)

    auth_codes_collection = get_mcp_auth_codes_collection()
    tokens_collection = get_mcp_tokens_collection()

    # ── Look up and validate the auth code ───────────────────────────────────
    now = datetime.now(timezone.utc)
    code_doc = await auth_codes_collection.find_one({"code": code, "used": False})

    if not code_doc:
        return JSONResponse({"error": "invalid_grant", "error_description": "Code not found or already used"}, status_code=400)

    if now > code_doc["expires_at"].replace(tzinfo=timezone.utc):
        return JSONResponse({"error": "invalid_grant", "error_description": "Authorization code has expired"}, status_code=400)

    if redirect_uri and code_doc.get("redirect_uri") != redirect_uri:
        return JSONResponse({"error": "invalid_grant", "error_description": "redirect_uri mismatch"}, status_code=400)

    # ── Mark code as used (single-use) ───────────────────────────────────────
    await auth_codes_collection.update_one({"code": code}, {"$set": {"used": True}})

    # ── Mint a persistent MCP access token ───────────────────────────────────
    expire_hours = settings.mcp_token_expire_hours
    access_token = f"sk-mcp-{uuid.uuid4().hex}"

    await tokens_collection.insert_one({
        "token": access_token,
        "user_id": code_doc["user_id"],
        "username": code_doc["username"],
        "role": code_doc["role"],
        "client_id": code_doc.get("client_id", client_id),
        "created_at": now,
        "expires_at": now + timedelta(hours=expire_hours),
        "active": True,
    })

    logger.info(
        "MCP OAuth: access token issued for '%s' (role=%s, expires_in=%dh)",
        code_doc["user_id"], code_doc["role"], expire_hours,
    )

    return JSONResponse({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": expire_hours * 3600,
        "scope": "mcp",
    })
