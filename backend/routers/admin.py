from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from core.dependencies import require_admin, require_master
from db.client import (
    get_users_collection, 
    get_presentations_collection, 
    get_settings_collection
)
from models.requests import (
    AdminCreateUser, UpdateRoleRequest, 
    UpdateStatusRequest
)
from core.security import get_password_hash
from core.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

@router.get("/stats")
async def admin_get_stats(admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_users_collection()
    presentations_coll = get_presentations_collection()
    
    total_users = await users_coll.count_documents({})
    total_generations = await presentations_coll.count_documents({})
    pending_approvals = await users_coll.count_documents({"status": "pending"})
    
    yesterday = datetime.utcnow() - timedelta(days=1)
    active_today = await presentations_coll.aggregate([
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "active_users"}
    ]).to_list(length=1)
    active_count = active_today[0]["active_users"] if active_today else 0
    
    return {
        "total_users": total_users,
        "total_generations": total_generations,
        "pending_approvals": pending_approvals,
        "active_today": active_count
    }

@router.get("/generations")
async def admin_get_all_presentations(
    admin_user: Annotated[dict, Depends(require_admin)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    presentations_coll = get_presentations_collection()
    cursor = presentations_coll.aggregate([
        {
            "$project": {
                "_id": 1, 
                "title": 1, 
                "theme": 1, 
                "created_at": 1,
                "username": {"$ifNull": ["$username", "Unknown"]},
                "slides_count": {"$size": {"$ifNull": ["$slides", []]}}
            }
        },
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ])
    
    presentations = await cursor.to_list(length=limit)
    serialized = []
    for p in presentations:
        p["id"] = str(p.pop("_id"))
        p["generated_by"] = p.pop("username")
        p["slides"] = p.pop("slides_count")
        p["tone"] = "Professional"
        p["status"] = "COMPLETE"
        if "created_at" in p:
            p["created_at"] = p["created_at"].isoformat()
        serialized.append(p)
        
    return {"presentations": serialized}

@router.delete("/generations/{presentation_id}")
async def admin_delete_presentation(presentation_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    presentations_coll = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")
        
    result = await presentations_coll.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    return {"status": "success"}

@router.get("/users")
async def admin_get_users(
    admin_user: Annotated[dict, Depends(require_admin)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    users_coll = get_users_collection()
    cursor = users_coll.aggregate([
        {"$project": {"password": 0}},
        {
            "$lookup": {
                "from": "presentations",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "presentations"
            }
        },
        {
            "$addFields": {
                "ppt_count": {"$size": "$presentations"}
            }
        },
        {"$project": {"presentations": 0}},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit}
    ])
    users = await cursor.to_list(length=limit)
    
    serialized = []
    for u in users:
        u["id"] = str(u.pop("_id"))
        if "created_at" in u:
            u["created_at"] = u["created_at"].isoformat()
        u.setdefault("status", "active")
        u.setdefault("role", "user")
        serialized.append(u)
        
    return {"users": serialized}

@router.put("/users/{user_id}/role")
async def admin_update_user_role(user_id: str, payload: UpdateRoleRequest, admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_users_collection()
    if payload.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    result = await users_coll.update_one({"_id": obj_id}, {"$set": {"role": payload.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "role": payload.role}

@router.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, payload: UpdateStatusRequest, admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    result = await users_coll.update_one({"_id": obj_id}, {"$set": {"status": payload.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "user_status": payload.status}

@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_users_collection()
    presentations_coll = get_presentations_collection()
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    if str(admin_user.get("user_id")) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    await presentations_coll.delete_many({"user_id": obj_id})
    result = await users_coll.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success"}

@router.post("/users/create")
async def admin_create_user(body: AdminCreateUser, admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_users_collection()
    existing = await users_coll.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    role = body.role if body.role in ["user", "admin"] else "user"
    if role == "admin" and admin_user.get("sub") != settings.master_email:
        status = "pending"
    else:
        status = "active"
    
    new_user = {
        "email": body.email,
        "password": get_password_hash(body.password),
        "full_name": body.full_name,
        "role": role,
        "status": status,
        "created_at": datetime.utcnow()
    }
    await users_coll.insert_one(new_user)
    
    return {"status": "success", "message": f"Account created with status: {status}"}

@router.get("/pending")
async def admin_get_pending(master_user: Annotated[dict, Depends(require_master)]):
    users_coll = get_users_collection()
    cursor = users_coll.find(
        {"status": "pending"},
        {"password": 0}
    ).sort("created_at", -1)
    pending = await cursor.to_list(length=100)
    
    serialized = []
    for u in pending:
        u["id"] = str(u.pop("_id"))
        if "created_at" in u:
            u["created_at"] = u["created_at"].isoformat()
        serialized.append(u)
        
    return {"pending": serialized}

@router.post("/approve/{user_id}")
async def admin_approve_user(user_id: str, master_user: Annotated[dict, Depends(require_master)]):
    users_coll = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await users_coll.update_one(
        {"_id": obj_id, "status": "pending"},
        {"$set": {"status": "active"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"status": "success", "message": "User approved and activated"}

@router.post("/reject/{user_id}")
async def admin_reject_user(user_id: str, master_user: Annotated[dict, Depends(require_master)]):
    users_coll = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await users_coll.update_one(
        {"_id": obj_id, "status": "pending"},
        {"$set": {"status": "rejected"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"status": "success", "message": "User rejected"}

@router.get("/settings")
async def admin_get_settings(admin_user: Annotated[dict, Depends(require_admin)]):
    settings_coll = get_settings_collection()
    config = await settings_coll.find_one({"id": "global_config"})
    if not config:
        return {
            "image_generation_enabled": True,
            "speaker_notes_enabled": True,
            "default_model": "groq"
        }
    return {
        "image_generation_enabled": config.get("image_generation_enabled", True),
        "speaker_notes_enabled": config.get("speaker_notes_enabled", True),
        "default_model": config.get("default_model", "groq")
    }

@router.patch("/settings")
async def admin_update_settings(payload: dict, admin_user: Annotated[dict, Depends(require_admin)]):
    settings_coll = get_settings_collection()
    update_data = {}
    if "image_generation_enabled" in payload:
        update_data["image_generation_enabled"] = bool(payload["image_generation_enabled"])
    if "speaker_notes_enabled" in payload:
        update_data["speaker_notes_enabled"] = bool(payload["speaker_notes_enabled"])
    if "default_model" in payload:
        update_data["default_model"] = str(payload["default_model"])
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid settings provided")
        
    await settings_coll.update_one(
        {"id": "global_config"},
        {"$set": update_data},
        upsert=True
    )
    return {"status": "success", "updated": update_data}

# Public read-only route for global settings
from core.dependencies import get_current_user
@router.get("/public/settings")
async def public_get_settings(current_user: Annotated[dict, Depends(get_current_user)]):
    settings_coll = get_settings_collection()
    config = await settings_coll.find_one({"id": "global_config"})
    if not config:
        return {"image_generation_enabled": True, "default_model": "groq"}
    return {
        "image_generation_enabled": config.get("image_generation_enabled", True),
        "default_model": config.get("default_model", "groq")
    }
