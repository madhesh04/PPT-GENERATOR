from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
import logging
from core.dependencies import require_admin, get_current_user
from db.client import (
    get_timesheet_users_collection,
    get_presentations_collection,
    get_settings_collection
)
from models.requests import (
    AdminCreateUser, UpdateRoleRequest,
    UpdateStatusRequest, UpdatePasswordRequest
)
from core.security import get_password_hash
from core.config import settings
from core.converters import serialize_mongo_doc

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# ── Helper: standard "externally managed" response ────────────────────────────
EXTERNAL_MANAGED_MSG = "USER_MANAGEMENT_DISABLED — User accounts are managed by the Timesheet system"


@router.get("/stats")
async def admin_get_stats(admin_user: Annotated[dict, Depends(require_admin)]):
    users_coll = get_timesheet_users_collection()
    presentations_coll = get_presentations_collection()

    total_users = await users_coll.count_documents({})
    total_generations = await presentations_coll.count_documents({})
    pending_approvals = 0  # No approval workflow in shared DB

    yesterday = datetime.utcnow() - timedelta(days=1)
    active_today = await presentations_coll.aggregate([
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "active_users"}
    ]).to_list(length=1)

    active_today = serialize_mongo_doc(active_today)
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
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "title": 1,
                "theme": 1,
                "created_at": 1,
                "model_used": {"$ifNull": ["$model_used", "Groq"]},
                "generated_by": {"$ifNull": ["$generated_by", "Unknown"]},
                "slides": {"$size": {"$ifNull": ["$slides", []]}}
            }
        }
    ])

    presentations = await cursor.to_list(length=limit)
    return {"presentations": presentations}

@router.delete("/generations/{presentation_id}")
async def admin_delete_presentation(presentation_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    presentations_coll = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except InvalidId:
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
    """Read-only listing of users from the external Timesheet database."""
    users_coll = get_timesheet_users_collection()
    cursor = users_coll.find(
        {},
        {"password": 0}  # Never expose password hashes
    ).sort("createdAt", -1).skip(skip).limit(limit)

    users = await cursor.to_list(length=limit)

    # Map Timesheet fields → Skynet's expected response format
    serialized = []
    for u in users:
        mapped = {
            "id": u.get("employeeId", str(u.get("_id", ""))),
            "email": u.get("employeeId", ""),
            "full_name": u.get("name", ""),
            "role": u.get("role", "user").lower(),
            "status": "active",  # Timesheet has no status field — all users active
            "team_lead": u.get("teamLead", ""),
            "ppt_count": 0,  # Can't join across databases
        }
        if "createdAt" in u and u["createdAt"]:
            mapped["created_at"] = u["createdAt"].isoformat() if hasattr(u["createdAt"], "isoformat") else str(u["createdAt"])
        else:
            mapped["created_at"] = None
        serialized.append(mapped)

    return {"users": serialized}

# ── Write endpoints — DISABLED (external shared DB) ───────────────────────────

@router.put("/users/{user_id}/role")
async def admin_update_user_role(user_id: str, payload: UpdateRoleRequest, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.patch("/users/{user_id}/status")
async def admin_update_user_status(user_id: str, payload: UpdateStatusRequest, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.patch("/users/{user_id}/password")
async def admin_update_user_password(user_id: str, payload: UpdatePasswordRequest, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.get("/users/{user_id}/ppts")
async def admin_get_user_presentations(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    """Get presentations for a given user. user_id is now employeeId."""
    presentations_coll = get_presentations_collection()
    cursor = presentations_coll.aggregate([
        {"$match": {"user_id": user_id}},
        {"$sort": {"created_at": -1}},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "title": 1,
                "theme": 1,
                "created_at": 1,
                "model_used": {"$ifNull": ["$model_used", "Groq"]},
                "generated_by": {"$ifNull": ["$generated_by", "Unknown"]},
                "slides": {"$size": {"$ifNull": ["$slides", []]}}
            }
        }
    ])

    ppts = await cursor.to_list(length=100)
    return {"presentations": ppts}

@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.post("/users/create")
async def admin_create_user(body: AdminCreateUser, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.get("/pending")
async def admin_get_pending(admin_user: Annotated[dict, Depends(require_admin)]):
    """No pending approvals — shared DB has no approval workflow."""
    return {"pending": []}

@router.post("/approve/{user_id}")
async def admin_approve_user(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

@router.post("/reject/{user_id}")
async def admin_reject_user(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    raise HTTPException(status_code=403, detail=EXTERNAL_MANAGED_MSG)

# ── Settings endpoints — UNCHANGED (uses skynet_db) ───────────────────────────

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
