from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta
import logging
from core.security import verify_password, get_password_hash, create_access_token
from models.requests import UserRegister, UserLogin
from db.client import get_users_collection
from core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

@router.post("/register")
async def register(user_data: UserRegister):
    users_collection = get_users_collection()
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    hashed_password = get_password_hash(user_data.password)
    # Role hardening: users can't self-assign roles anymore as per UserRegister model change
    requested_role = "user" 
    status = "active"
    
    new_user = {
        "email": user_data.email,
        "password": hashed_password,
        "full_name": user_data.full_name,
        "role": requested_role,
        "status": status,
        "created_at": datetime.utcnow()
    }
    await users_collection.insert_one(new_user)
    return {"message": "Registration successful"}

@router.post("/login")
async def login(credentials: UserLogin):
    users_collection = get_users_collection()
    logger.info("Login attempt for %s (claimed: %s)", credentials.email, credentials.login_as)
    user = await users_collection.find_one({"email": credentials.email})
    if not user:
        logger.warning("Login failed: User %s not found", credentials.email)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        logger.warning("Login failed: Incorrect password for %s.", credentials.email)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")
    
    claimed_role = "user" if credentials.login_as == "employee" else credentials.login_as
    db_role = user.get("role", "user").lower()

    # Role enforcement matrix:
    # - employee tab  → only db_role == "user" is allowed
    # - admin tab     → db_role must be "admin" or "master"
    # - master tab    → db_role must be "master"
    # An admin / master attempting to log in via the employee tab is explicitly denied.
    is_authorized = False
    if claimed_role == "user":
        is_authorized = db_role == "user"
    elif claimed_role == "admin":
        is_authorized = db_role in ["admin", "master"]
    elif claimed_role == "master":
        is_authorized = db_role == "master"

    if not is_authorized:
        logger.warning(
            "Role mismatch for %s — claimed '%s', db role is '%s'",
            credentials.email, claimed_role, db_role
        )
        raise HTTPException(
            status_code=403,
            detail=f"ACCESS_DENIED — Account role '{db_role.upper()}' is not permitted on the '{credentials.login_as.upper()}' portal"
        )

    # Status check applies to ALL roles, not just admins
    user_status = user.get("status", "active")
    if user_status == "pending":
        raise HTTPException(status_code=403, detail="ACCESS_PENDING — Awaiting master account approval")
    if user_status in ("rejected", "disabled", "suspended"):
        raise HTTPException(status_code=403, detail="ACCESS_DENIED — Account has been deactivated")
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    
    payload_data = {
        "sub": user["email"],
        "user_id": str(user["_id"]),
        "username": user["full_name"],
        "role": db_role.upper(),
        "status": user.get("status", "active").upper()
    }
    access_token = create_access_token(
        data=payload_data, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"],
            "role": db_role.upper()
        }
    }
