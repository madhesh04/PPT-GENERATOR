from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse

from typing import Annotated
import time
import base64
import logging
from bson import ObjectId
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.dependencies import get_current_user
from core.converters import serialize_mongo_doc
from core.utils import sanitize_filename
from models.requests import (
    PresentationRequest, RegenerateSlideRequest, 
    RegenerateImageRequest, ExportRequest
)
from db.client import (
    get_presentations_collection, 
    get_generation_logs_collection,
    get_settings_collection
)
from services.generation_service import get_presentation_cache, handle_cache_hit, run_generation_pipeline
from services.storage_service import StorageService
from services.file_extractor import extract_text_from_file
from pdf_generator import create_pdf_presentation
from generator import create_presentation
from llm_client import generate_slide_content
from image_client import fetch_slide_image

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
    limit: int = Query(20, ge=1, le=100)
):
    coll = get_presentations_collection()
    user_oid = current_user["user_id"]  # employeeId string
    total = await coll.count_documents({"user_id": user_oid})
    cursor = coll.find(
        {"user_id": user_oid},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    presentations = await cursor.to_list(length=limit)
    return {
        "presentations": serialize_mongo_doc(presentations),
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/upload-context")
async def upload_context(file: UploadFile = File(...), current_user: Annotated[dict, Depends(get_current_user)] = None):
    content = await file.read()
    text = extract_text_from_file(content, file.filename)
    return {"text": text, "filename": file.filename}


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
        image_bytes_list = []
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
        
        image_bytes_list = []
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
    
    return {"status": "success", "message": "Presentation deleted"}
