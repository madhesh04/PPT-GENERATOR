from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
import logging

from core.dependencies import get_current_user
from db.client import get_bank_collection, get_presentations_collection
from core.converters import serialize_mongo_doc

router = APIRouter(prefix="/bank", tags=["bank"])
logger = logging.getLogger(__name__)


# ── Request Models ─────────────────────────────────────────────────────────────
class CreateBankRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    track: Optional[str] = None
    client: Optional[str] = None


class UpdateBankRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    track: Optional[str] = None
    client: Optional[str] = None


class AddModuleRequest(BaseModel):
    ppt_id: str = Field(..., description="Presentation ObjectId as string")


class ReorderModulesRequest(BaseModel):
    ordered_ppt_ids: list[str] = Field(..., description="PPT IDs in desired order")


# ── Helpers ────────────────────────────────────────────────────────────────────
def _check_ownership(bank: dict, current_user: dict) -> None:
    is_owner = bank.get("created_by") == current_user["user_id"]
    is_admin = current_user.get("role", "").upper() in ["ADMIN", "MASTER"]
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="UNAUTHORIZED — Only bank creator or admin can modify this bank")


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("")
async def create_bank(
    body: CreateBankRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    now = datetime.now(timezone.utc)
    doc = {
        "title": body.title,
        "description": body.description or "",
        "created_by": current_user["user_id"],
        "created_by_name": current_user.get("username", "Unknown"),
        "created_at": now,
        "updated_at": now,
        "modules": [],
        "track": body.track,
        "client": body.client,
    }
    res = await coll.insert_one(doc)
    return {"id": str(res.inserted_id), "title": doc["title"]}


@router.get("")
async def list_banks(
    current_user: Annotated[dict, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    coll = get_bank_collection()
    total = await coll.count_documents({})
    cursor = coll.find(
        {},
        {"_id": 1, "title": 1, "description": 1, "created_by": 1, "created_by_name": 1,
         "created_at": 1, "updated_at": 1, "track": 1, "client": 1,
         "module_count": {"$size": {"$ifNull": ["$modules", []]}}}
    ).sort("created_at", -1).skip(skip).limit(limit)
    banks = await cursor.to_list(length=limit)
    # Compute module count manually since Motor doesn't support $size in projection
    cursor2 = coll.find({}).sort("created_at", -1).skip(skip).limit(limit)
    raw = await cursor2.to_list(length=limit)
    result = []
    for s in raw:
        result.append({
            "id": str(s["_id"]),
            "title": s.get("title", ""),
            "description": s.get("description", ""),
            "created_by": s.get("created_by", ""),
            "created_by_name": s.get("created_by_name", "Unknown"),
            "created_at": s.get("created_at", "").isoformat() if hasattr(s.get("created_at"), "isoformat") else str(s.get("created_at", "")),
            "updated_at": s.get("updated_at", "").isoformat() if hasattr(s.get("updated_at"), "isoformat") else str(s.get("updated_at", "")),
            "module_count": len(s.get("modules", [])),
            "track": s.get("track"),
            "client": s.get("client"),
        })
    return {"banks": result, "total": total}


@router.get("/{bank_id}")
async def get_bank(
    bank_id: str,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")

    return serialize_mongo_doc(bank)


@router.patch("/{bank_id}")
async def update_bank(
    bank_id: str,
    body: UpdateBankRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    _check_ownership(bank, current_user)

    update_fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await coll.update_one({"_id": obj_id}, {"$set": update_fields})

    return {"status": "success"}


@router.delete("/{bank_id}")
async def delete_bank(
    bank_id: str,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    _check_ownership(bank, current_user)

    await coll.delete_one({"_id": obj_id})
    return {"status": "success"}


@router.post("/{bank_id}/modules")
async def add_module_to_bank(
    bank_id: str,
    body: AddModuleRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    ppt_coll = get_presentations_collection()

    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    _check_ownership(bank, current_user)

    # Validate the PPT exists
    try:
        ppt_id = ObjectId(body.ppt_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")

    ppt = await ppt_coll.find_one({"_id": ppt_id}, {"title": 1})
    if not ppt:
        raise HTTPException(status_code=404, detail="Presentation not found")

    # Avoid duplicates
    existing_ids = [m.get("ppt_id") for m in bank.get("modules", [])]
    if body.ppt_id in existing_ids:
        raise HTTPException(status_code=409, detail="Presentation already in bank")

    next_order = len(bank.get("modules", [])) + 1
    module_entry = {
        "ppt_id": body.ppt_id,
        "ppt_title": ppt.get("title", ""),
        "order": next_order,
    }
    await coll.update_one(
        {"_id": obj_id},
        {"$push": {"modules": module_entry}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return {"status": "success", "module": module_entry}


@router.delete("/{bank_id}/modules/{ppt_id}")
async def remove_module_from_bank(
    bank_id: str,
    ppt_id: str,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    _check_ownership(bank, current_user)

    await coll.update_one(
        {"_id": obj_id},
        {"$pull": {"modules": {"ppt_id": ppt_id}}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return {"status": "success"}


@router.patch("/{bank_id}/modules/reorder")
async def reorder_bank_modules(
    bank_id: str,
    body: ReorderModulesRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_bank_collection()
    try:
        obj_id = ObjectId(bank_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid bank ID")

    bank = await coll.find_one({"_id": obj_id})
    if not bank:
        raise HTTPException(status_code=404, detail="Bank not found")
    _check_ownership(bank, current_user)

    modules_by_id = {m["ppt_id"]: m for m in bank.get("modules", [])}
    reordered = []
    for i, ppt_id in enumerate(body.ordered_ppt_ids):
        if ppt_id in modules_by_id:
            m = modules_by_id[ppt_id].copy()
            m["order"] = i + 1
            reordered.append(m)

    await coll.update_one(
        {"_id": obj_id},
        {"$set": {"modules": reordered, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"status": "success", "modules": reordered}
