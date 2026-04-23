from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse

from typing import Annotated, Optional
import time
import base64
import hashlib
import logging
from bson import ObjectId
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.dependencies import get_current_user
from core.converters import serialize_mongo_doc
from core.utils import sanitize_filename
from models.requests import (
    PresentationRequest, RegenerateSlideRequest, 
    RegenerateImageRequest, ExportRequest, NotesRequest
)
from db.client import (
    get_presentations_collection, 
    get_generation_logs_collection,
    get_settings_collection,
    get_audit_logs_collection,
)
from services.generation_service import get_presentation_cache, handle_cache_hit, run_generation_pipeline
from services.storage_service import StorageService
from services.file_extractor import extract_text_from_file
from services.audit_service import log_action
from pdf_generator import create_pdf_presentation
from generator import create_presentation
from llm_client import generate_slide_content, generate_lecture_notes
from image_client import fetch_slide_image
from pydantic import BaseModel, Field

router = APIRouter(tags=["generate"])
logger = logging.getLogger(__name__)

# Rate limiter — keyed by IP address
limiter = Limiter(key_func=get_remote_address)


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    start_time = time.time()
    user_id = current_user["user_id"]  # employeeId string (no ObjectId conversion)
    
    cached, content_hash = await get_presentation_cache(
        body.title, body.topics, body.tone, body.theme, body.num_slides, body.context
    )
    
    if cached:
        logger.info("Cache Hit for hash %s. Re-routing blueprint to user.", content_hash)
        return await handle_cache_hit(cached, content_hash, current_user, start_time)

    return await run_generation_pipeline(body, current_user, start_time, content_hash)


@router.post("/generate-notes")
@limiter.limit("10/minute")
async def generate_notes(request: Request, body: NotesRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    start_time = time.time()
    user_id = current_user["user_id"]
    presentations_collection = get_presentations_collection()
    logs_collection = get_generation_logs_collection()
    
    # Simple hash for content
    content_hash = hashlib.sha256(f"notes-{body.subject}-{body.unit}-{body.format}-{body.depth}".encode()).hexdigest()
    
    import asyncio
    # Attempt generation
    try:
        content, model_used, provider = await asyncio.wait_for(
            generate_lecture_notes(
                body.subject, body.unit, body.topics, body.context, body.pages, body.depth, body.format, body.force_provider
            ),
            timeout=180.0
        )
    except asyncio.TimeoutError:
        logger.error("Error generating notes: timeout")
        raise HTTPException(status_code=504, detail="Failed to generate lecture notes: timeout.")
    except Exception as e:
        logger.error(f"Error generating notes: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate lecture notes.")

    # Save to presentations collection using type='notes'
    timestamp = datetime.now(timezone.utc)
    new_doc = {
        "user_id": user_id,
        "generated_by": current_user.get("username", "Unknown"),
        "username": current_user.get("username", "Unknown"),
        "title": f"Notes: {body.subject} - {body.unit}".strip("- "),
        "topics": body.topics,
        "content_hash": content_hash,
        "content": content, # Store raw markdown
        "slides": [], # Notes don't have slides, but schema might expect list
        "created_at": timestamp,
        "updated_at": timestamp,
        "last_edited_by": None,
        "theme": "notes",
        "type": "notes",
        "depth": body.depth,
        "format": body.format,
        "track": body.track,
        "client": body.client,
        "module": None,
        "course": None,
    }
    
    res = await presentations_collection.insert_one(new_doc)
    
    await logs_collection.insert_one({
        "user_id": str(user_id),
        "presentation_id": res.inserted_id,
        "action": "generate_notes",
        "status": "success",
        "execution_time_ms": int((time.time() - start_time) * 1000),
        "timestamp": timestamp
    })

    await log_action("CREATE", current_user, str(res.inserted_id), new_doc["title"])

    return {
        "title": new_doc["title"],
        "content": content,
        "token": str(res.inserted_id),
        "filename": f"{sanitize_filename(new_doc['title'])}.md",
        "model_used": model_used,
        "provider": provider
    }


@router.post("/regenerate-slide")
async def regenerate_slide(body: RegenerateSlideRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    try:
        prompt_suffix = f"\nAvoid creating slides with these exact titles: {', '.join(body.existing_titles)}"
        new_slide_list, _, _ = await generate_slide_content(
            body.title, ["New Insight"], 1, body.context + prompt_suffix, body.tone
        )
        if not new_slide_list:
            raise HTTPException(status_code=500, detail="AI failed to generate slide.")
        
        new_slide = new_slide_list[0]
        img_bytes = await fetch_slide_image(new_slide.get("image_query", new_slide.get("title", "")))
        if img_bytes:
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            new_slide["image_base64"] = f"data:image/jpeg;base64,{b64}"
        else:
            new_slide["image_base64"] = None
            
        return new_slide
    except Exception as e:
        logger.exception("Error regenerating slide: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regenerate-image")
async def regenerate_image(body: RegenerateImageRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    settings_coll = get_settings_collection()
    global_config = await settings_coll.find_one({"id": "global_config"})
    if global_config and not global_config.get("image_generation_enabled", True):
        raise HTTPException(status_code=403, detail="IMAGE_GENERATION_DISABLED_GLOBALLY")

    img_bytes = await fetch_slide_image(body.query)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Could not find a new image.")
    
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return {"image_base64": f"data:image/jpeg;base64,{b64}"}


@router.get("/presentations/me")
async def get_my_presentations(
    current_user: Annotated[dict, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000)
):
    coll = get_presentations_collection()
    user_oid = current_user["user_id"]  # employeeId string
    total = await coll.count_documents({"user_id": user_oid})
    cursor = coll.find(
        {"user_id": user_oid},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "updated_at": 1,
         "type": 1, "track": 1, "generated_by": 1, "last_edited_by": 1,
         "tone": 1, "num_slides_requested": 1}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    presentations = await cursor.to_list(length=limit)
    return {
        "presentations": serialize_mongo_doc(presentations),
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/presentations/all")
async def get_all_presentations(
    current_user: Annotated[dict, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Returns presentations from all users.
    Accessible to any authenticated user (view-only listing).
    """
    coll = get_presentations_collection()
    total = await coll.count_documents({})
    cursor = coll.find(
        {},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "updated_at": 1,
         "type": 1, "track": 1, "generated_by": 1, "username": 1,
         "last_edited_by": 1, "user_id": 1}
    ).sort("created_at", -1).skip(skip).limit(limit)
    presentations = await cursor.to_list(length=limit)
    return {
        "presentations": serialize_mongo_doc(presentations),
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/presentations/search")
async def search_presentations(
    current_user: Annotated[dict, Depends(get_current_user)],
    q: str = Query(..., min_length=2, max_length=100),
    scope: str = Query("mine"),  # "mine" or "all"
):
    coll = get_presentations_collection()
    query: dict = {"title": {"$regex": q, "$options": "i"}}
    if scope == "mine":
        query["user_id"] = current_user["user_id"]
    cursor = coll.find(
        query,
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "type": 1,
         "generated_by": 1, "user_id": 1}
    ).sort("created_at", -1).limit(20)
    results = await cursor.to_list(length=20)
    return {"results": serialize_mongo_doc(results)}


@router.get("/my/activity")
async def get_my_activity(
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(5, ge=1, le=20)
):
    coll = get_audit_logs_collection()
    cursor = coll.find(
        {"user_id": current_user["user_id"]}
    ).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    return {"activity": serialize_mongo_doc(logs)}


@router.post("/upload-context")
async def upload_context(current_user: Annotated[dict, Depends(get_current_user)], file: UploadFile = File(...)):
    content = await file.read()
    text = extract_text_from_file(content, file.filename)
    return {"text": text, "filename": file.filename}


class UrlExtractRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=500)


@router.post("/extract-url")
async def extract_from_url(
    body: UrlExtractRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    from services.file_extractor import extract_text_from_url  # type: ignore
    try:
        text = await extract_text_from_url(body.url)
        return {"text": text, "source": body.url}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


class UpdatePresentationRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    track: Optional[str] = None
    client: Optional[str] = None


@router.patch("/presentations/{presentation_id}")
async def update_presentation(
    presentation_id: str,
    body: UpdatePresentationRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")

    presentation = await coll.find_one({"_id": obj_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Not found")

    is_owner = presentation.get("user_id") == current_user["user_id"]
    is_admin = current_user.get("role", "").upper() in ["ADMIN", "MASTER"]

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="UNAUTHORIZED — Can only edit your own content")

    # Build changes dict for audit log
    changes = {}
    update_fields: dict = {}
    for field, val in body.model_dump().items():
        if val is not None and presentation.get(field) != val:
            changes[field] = {"before": presentation.get(field), "after": val}
            update_fields[field] = val

    if not update_fields:
        return {"status": "no_changes"}

    update_fields["updated_at"] = datetime.now(timezone.utc)
    update_fields["last_edited_by"] = current_user.get("username", current_user["user_id"])

    await coll.update_one({"_id": obj_id}, {"$set": update_fields})
    await log_action("UPDATE", current_user, presentation_id, presentation.get("title", ""), changes=changes)
    return {"status": "success"}


@router.post("/export-pdf")
async def export_pdf(req: ExportRequest, user: Annotated[dict, Depends(get_current_user)]):
    try:
        pdf_io = create_pdf_presentation(req.title, [s.model_dump() for s in req.slides], req.theme)
        safe_title = sanitize_filename(req.title)
        fn = f"{safe_title}_{int(time.time())}.pdf"
        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fn}"'}
        )
    except Exception as e:
        logger.error("PDF Export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"PDF_EXPORT_FAILED: {str(e)}")


@router.post("/export")
async def export_ppt(body: ExportRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    try:
        # Convert base64 fields back to bytes
        from typing import Optional
        image_bytes_list: list[Optional[bytes]] = []
        for slide in body.slides:
            if slide.image_base64:
                try:
                    header, data = slide.image_base64.split(',', 1)
                    image_bytes_list.append(base64.b64decode(data))
                except (ValueError, Exception) as e:
                    logger.warning("Failed to decode base64 image for slide, skipping: %s", e)
                    image_bytes_list.append(None)
            else:
                image_bytes_list.append(None)

        # Generate binary
        safe_title = sanitize_filename(body.title)
        ppt_io, filename = create_presentation(
            body.title, 
            [s.model_dump() for s in body.slides], 
            image_bytes_list, 
            theme_name=body.theme
        )
        # Ensure filename is sanitized
        filename = f"{safe_title}.pptx"
        
        # Save final binary to GridFS
        file_id = await StorageService.save_file(
            filename, 
            ppt_io.getvalue(), 
            metadata={
                "user_id": current_user["user_id"],
                "type": "pptx",
                "title": body.title
            }
        )

        await log_action("EXPORT", current_user, file_id, body.title)
        return {"token": file_id, "filename": filename}
    except Exception as e:
        logger.exception("Export failed: %s", e)
        # Production: mask internal error
        raise HTTPException(status_code=500, detail="DOWNLOAD_PACKAGE_GENERATION_FAILED")


@router.get("/download/{file_id}")
@limiter.limit("30/minute")
async def download_ppt(request: Request, file_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Download a presentation by its file_id (GridFS) or presentation_id (MongoDB).
    Requires authentication. Users can only download their own presentations.
    """
    # 1. Try to fetch from GridFS directly
    stream = await StorageService.get_file_stream(file_id)
    
    # 2. If not in GridFS, try to generate on-the-fly from presentation_id
    if not stream:
        logger.info(f"File {file_id} not found in GridFS. Attempting on-the-fly generation from presentation_id.")
        presentations_collection = get_presentations_collection()
        try:
            obj_id = ObjectId(file_id)
        except Exception:
            raise HTTPException(status_code=400, detail="INVALID_IDENTIFIER")
            
        # Ownership check: user can only access their own presentations UNLESS they are admin/master
        presentation = await presentations_collection.find_one({"_id": obj_id})
        if not presentation:
            raise HTTPException(status_code=404, detail="FILE_OR_PRESENTATION_NOT_FOUND")
            
        is_owner = presentation.get("user_id") == current_user["user_id"]
        is_admin = current_user.get("role", "").upper() in ["ADMIN", "MASTER"]
        
        if not (is_owner or is_admin):
            raise HTTPException(status_code=403, detail="UNAUTHORIZED_ACCESS")
            
        slides = presentation.get("slides", [])
        title = presentation.get("title", "Presentation")
        theme = presentation.get("theme", "standard")
        
        from typing import Optional  # already imported at top
        image_bytes_list: list[Optional[bytes]] = []
        for s in slides:
            b64 = s.get("image_base64")
            if b64 and "," in b64:
                try:
                    image_bytes_list.append(base64.b64decode(b64.split(",")[1]))
                except (ValueError, Exception) as e:
                    logger.warning("Failed to decode stored image for slide: %s", e)
                    image_bytes_list.append(None)
            else:
                image_bytes_list.append(None)
        
        ppt_io, filename = create_presentation(title, slides, image_bytes_list, theme_name=theme)
        ppt_io.seek(0)
        
        return StreamingResponse(
            ppt_io,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    
    filename = getattr(stream, 'filename', 'presentation.pptx')
    await log_action("DOWNLOAD", current_user, file_id, filename)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.delete("/presentations/{presentation_id}")
@limiter.limit("30/minute")
async def delete_presentation(request: Request, presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    presentations_collection = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")
        
    # Ownership check: only owner OR admin can delete
    presentation = await presentations_collection.find_one({"_id": obj_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
        
    is_owner = presentation.get("user_id") == current_user["user_id"]
    is_admin = current_user.get("role", "").upper() in ["ADMIN", "MASTER"]
    
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Unauthorized attempt to delete presentation")
        
    result = await presentations_collection.delete_one({"_id": obj_id})
    if result.deleted_count > 0:
        await log_action("DELETE", current_user, presentation_id, presentation.get("title", ""))
    
    return {"status": "success", "message": "Presentation deleted"}
