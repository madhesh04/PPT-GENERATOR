from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta
import logging
from core.security import verify_password, create_access_token
from models.requests import UserLogin
from db.client import get_timesheet_users_collection
from core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

@router.post("/register")
async def register():
    """Registration is disabled — users are managed by the Timesheet system."""
    raise HTTPException(
        status_code=403,
        detail="REGISTRATION_DISABLED — User accounts are managed by the Timesheet system. Contact your administrator."
    )

@router.post("/login")
async def login(credentials: UserLogin):
    users_collection = get_timesheet_users_collection()

    # ── Look up user by employeeId (sent as 'email' field for backward compat) ──
    employee_id = credentials.email.strip()
    logger.info("Login attempt for employeeId=%s (claimed: %s)", employee_id, credentials.login_as)

    user = await users_collection.find_one({"employeeId": employee_id})
    if not user:
        logger.warning("Login failed: employeeId %s not found", employee_id)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")

    # ── Verify password (bcrypt — same algo used by Timesheet app) ──
    if not verify_password(credentials.password, user["password"]):
        logger.warning("Login failed: Incorrect password for %s.", employee_id)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")

    # ── Use role directly from DB — no master override ──
    db_role = user.get("role", "user").strip().lower()

    # Map login_as tab → expected role
    claimed_role = "user" if credentials.login_as == "employee" else credentials.login_as

    # Role enforcement:
    # - employee tab → any non-admin role (employee, user, etc.)
    # - admin tab    → only "admin" role
    is_authorized = False
    if claimed_role == "user":
        is_authorized = db_role != "admin"  # All non-admin roles can use employee tab
    elif claimed_role == "admin":
        is_authorized = db_role == "admin"

    if not is_authorized:
        logger.warning(
            "Role mismatch for %s — claimed '%s', DB role is '%s'",
            employee_id, claimed_role, db_role
        )
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS_DENIED — Account role '{db_role.upper()}' is not permitted on the '{credentials.login_as.upper()}' portal"
        )

    # ── Normalize role for frontend ──
    frontend_role = "ADMIN" if db_role == "admin" else "USER"

    # ── Build JWT token (same payload structure for frontend compatibility) ──
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)

    payload_data = {
        "sub": employee_id,                          # employeeId as subject
        "user_id": employee_id,                      # employeeId as user_id
        "username": user.get("name", employee_id),   # Timesheet 'name' field
        "role": frontend_role,
        "team_lead": user.get("teamLead", ""),
    }
    access_token = create_access_token(
        data=payload_data, expires_delta=access_token_expires
    )

    # ── Response (identical shape to original for frontend compat) ──
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": employee_id,                         # employeeId mapped to email
            "full_name": user.get("name", employee_id),   # Timesheet 'name' → full_name
            "role": frontend_role
        }
    }
