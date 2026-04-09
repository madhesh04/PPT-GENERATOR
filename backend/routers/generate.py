from fastapi import APIRouter, Depends, Request, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from typing import Annotated
import time
import logging
from bson import ObjectId
from datetime import datetime
from core.dependencies import get_current_user
from models.requests import (
    PresentationRequest, RegenerateSlideRequest, 
    RegenerateImageRequest, ExportRequest
)
from db.client import (
    get_presentations_collection, 
    get_generation_logs_collection,
    get_settings_collection
)
from services.generation_service import get_presentation_cache, run_generation_pipeline
from llm_client import is_technical_topic, generate_slide_content
from image_client import fetch_slide_image
import base64

router = APIRouter(tags=["generate"])
logger = logging.getLogger(__name__)

@router.post("/generate")
async def generate_ppt(request: Request, body: PresentationRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    start_time = time.time()
    user_id = ObjectId(current_user["user_id"])
    
    cached, content_hash = await get_presentation_cache(
        body.title, body.topics, body.tone, body.theme, body.num_slides, body.context
    )
    
    if cached:
        logger.info(f"Cache Hit for hash {content_hash}. Re-routing blueprint to user.")
        presentations_collection = get_presentations_collection()
        logs_collection = get_generation_logs_collection()
        
        new_doc = {
            "user_id": user_id,
            "title": cached["title"],
            "topics": cached["topics"],
            "content_hash": content_hash,
            "slides": cached["slides"],
            "created_at": datetime.utcnow(),
            "theme": cached.get("theme", body.theme)
        }
        res = await presentations_collection.insert_one(new_doc)
        
        await logs_collection.insert_one({
            "user_id": current_user.get("user_id"),
            "presentation_id": res.inserted_id,
            "action": "generate",
            "status": "cache_hit",
            "execution_time_ms": int((time.time() - start_time) * 1000),
            "timestamp": datetime.utcnow()
        })
        
        return {
            "title": new_doc["title"],
            "slides": new_doc["slides"],
            "theme": new_doc["theme"],
            "token": str(res.inserted_id),
            "filename": f"{cached['title'].replace(' ', '_')}.pptx"
        }

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
async def get_my_presentations(current_user: Annotated[dict, Depends(get_current_user)]):
    presentations_collection = get_presentations_collection()
    cursor = presentations_collection.find(
        {"user_id": ObjectId(current_user["user_id"])},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1}
    ).sort("created_at", -1)
    
    presentations = await cursor.to_list(length=100)
    serialized = []
    for p in presentations:
        p["id"] = str(p.pop("_id"))
        p["created_at"] = p["created_at"].isoformat()
        serialized.append(p)
        

@router.post("/upload-context")
async def upload_context(file: UploadFile = File(...), current_user: Annotated[dict, Depends(get_current_user)] = None):
    from file_extractor import extract_text_from_file
    content = await file.read()
    text = extract_text_from_file(content, file.filename)
    return {"text": text, "filename": file.filename}

@router.post("/export-pdf")
async def export_pdf(req: ExportRequest, user: Annotated[dict, Depends(get_current_user)]):
    from pdf_generator import create_pdf_presentation
    try:
        pdf_io = create_pdf_presentation(req.title, [s.model_dump() for s in req.slides], req.theme)
        fn = f"{req.title.replace(' ', '_')}_{int(time.time())}.pdf"
        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={fn}"}
        )
    except Exception as e:
        logger.error("PDF Export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"PDF_EXPORT_FAILED: {str(e)}")

@router.post("/export-pptx")
async def export_ppt(body: ExportRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    from generator import create_presentation
    from services.storage_service import StorageService
    try:
        # Convert base64 fields back to bytes
        image_bytes_list = []
        for slide in body.slides:
            if slide.image_base64:
                try:
                    header, data = slide.image_base64.split(',', 1)
                    image_bytes_list.append(base64.b64decode(data))
                except:
                    image_bytes_list.append(None)
            else:
                image_bytes_list.append(None)

        # Generate binary
        ppt_io, filename = create_presentation(
            body.title, 
            [s.model_dump() for s in body.slides], 
            image_bytes_list, 
            theme_name=body.theme
        )
        
        # Phase 3: Save final binary to GridFS
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
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{file_id}")
async def download_ppt(file_id: str):
    # No auth for direct download link usually if it's a random token, 
    # but the implementation plan can decide. For now, following GridFS retrieval.
    from services.storage_service import StorageService
    
    stream = await StorageService.get_file_stream(file_id)
    if not stream:
        raise HTTPException(status_code=404, detail="File not found or expired.")
    
    filename = getattr(stream, 'filename', 'presentation.pptx')
    
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    presentations_collection = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")
        
    result = await presentations_collection.delete_one({
        "_id": obj_id,
        "user_id": ObjectId(current_user["user_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found or unauthorized")
    return {"status": "success", "message": "Presentation deleted"}

