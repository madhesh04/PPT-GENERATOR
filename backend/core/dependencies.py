from fastapi import HTTPException, Request, Depends
from typing import Annotated
import jwt
from core.config import settings

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
        if "sub" not in payload or "role" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: Annotated[dict, Depends(get_current_user)]):
    role = current_user.get("role", "USER").upper()
    if role not in ["ADMIN", "MASTER"]:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED — Insufficient privileges")
    return current_user

async def require_master(current_user: Annotated[dict, Depends(get_current_user)]):
    if current_user.get("sub") != settings.master_email:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED — Master privileges required")
    return current_user
