import asyncio
import base64
import hashlib
import logging
import time
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException
from core.config import settings
from db.client import get_presentations_collection, get_generation_logs_collection, get_settings_collection
from llm_client import generate_slide_content
from image_client import fetch_slide_image

logger = logging.getLogger(__name__)

async def get_presentation_cache(body_title: str, topics: list, tone: str, theme: str, num_slides: int, context: str):
    presentations_collection = get_presentations_collection()
    
    # Phase 2 Fix: Improved cache key including num_slides and context hash
    ctx_hash = hashlib.md5(context.strip().encode()).hexdigest()[:8]
    normalized_str = (
        f"{body_title.lower().strip()}"
        f"-{'|'.join(sorted(t.lower().strip() for t in topics))}"
        f"-{tone}-{theme}"
        f"-slides{num_slides}"
        f"-ctx{ctx_hash}"
    )
    content_hash = hashlib.sha256(normalized_str.encode('utf-8')).hexdigest()
    
    cached = await presentations_collection.find_one({"content_hash": content_hash})
    return cached, content_hash

async def run_generation_pipeline(body, current_user, start_time: float, content_hash: str):
    presentations_collection = get_presentations_collection()
    logs_collection = get_generation_logs_collection()
    settings_coll = get_settings_collection()
    
    user_id = ObjectId(current_user["user_id"])
    
    # Check global system settings
    global_config = await settings_coll.find_one({"id": "global_config"})
    if not global_config:
        global_config = {"image_generation_enabled": True, "speaker_notes_enabled": True, "default_model": "groq"}

    images_enabled = global_config.get("image_generation_enabled", True)
    notes_enabled = global_config.get("speaker_notes_enabled", True)
    default_model_choice = global_config.get("default_model", "groq")

    # Phase 2 Fix: Wrap LLM call with timeout
    try:
        presentation_data, model_used, provider = await asyncio.wait_for(
            generate_slide_content(
                body.title, body.topics, body.num_slides, body.context, body.tone,
                force_provider=body.force_provider or default_model_choice,
                include_notes=notes_enabled
            ),
            timeout=45.0
        )
    except asyncio.TimeoutError:
        logger.error("LLM synthesis timed out")
        raise HTTPException(status_code=504, detail="AI generation timed out. Please try again.")

    if not presentation_data:
        raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

    async def _maybe_fetch_image(slide):
        if not images_enabled:
            return None
        query = slide.get("image_query")
        if query:
            # Phase 2 Fix: Wrap image fetch with timeout
            try:
                return await asyncio.wait_for(fetch_slide_image(query), timeout=25.0)
            except asyncio.TimeoutError:
                return None
        return None

    image_tasks = [_maybe_fetch_image(slide) for slide in presentation_data]
    image_bytes_list = await asyncio.gather(*image_tasks, return_exceptions=True)
    image_bytes_list = [img if isinstance(img, bytes) else None for img in image_bytes_list]

    for slide, img_bytes in zip(presentation_data, image_bytes_list):
        if img_bytes:
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            slide["image_base64"] = f"data:image/jpeg;base64,{b64}"
        else:
            slide["image_base64"] = None

    # Strip images for DB storage
    db_slides = []
    for s in presentation_data:
        s_copy = s.copy()
        s_copy["image_base64"] = None
        db_slides.append(s_copy)

    new_doc = {
        "user_id": user_id,
        "username": current_user.get("username", "Unknown"),
        "title": body.title,
        "topics": body.topics,
        "content_hash": content_hash,
        "slides": db_slides,
        "created_at": datetime.utcnow(),
        "theme": body.theme
    }
    res = await presentations_collection.insert_one(new_doc)
    
    await logs_collection.insert_one({
        "user_id": str(user_id),
        "presentation_id": res.inserted_id,
        "action": "generate",
        "status": "success",
        "execution_time_ms": int((time.time() - start_time) * 1000),
        "timestamp": datetime.utcnow()
    })

    return {
        "title": body.title,
        "slides": presentation_data,
        "theme": body.theme,
        "token": str(res.inserted_id),
        "filename": f"{body.title.replace(' ', '_')}.pptx",
        "model_used": model_used,
        "provider": provider
    }
