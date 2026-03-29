import os
import io
import uuid
import time
import logging
import asyncio
import uvicorn
import base64
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Annotated, Optional
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Document extraction
from pypdf import PdfReader
from docx import Document

# IMPORTANT: load env vars FIRST before importing local modules
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from backend.generator import create_presentation
from backend.llm_client import generate_slide_content, GROQ_MODEL
from backend.image_client import fetch_slide_image

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["20/minute"])

# ── In-memory PPT store ────────────────────────────────────────────────────────
# { token: (BytesIO, filename, created_at) }
PPT_TTL = 300  # 5 minutes
_ppt_store: dict[str, tuple[io.BytesIO, str, float]] = {}


async def _cleanup_expired_tokens():
    """Background task: remove tokens older than PPT_TTL seconds."""
    while True:
        await asyncio.sleep(60)
        now = time.time()
        expired = [k for k, (_, _, ts) in _ppt_store.items() if now - ts > PPT_TTL]
        for k in expired:
            del _ppt_store[k]
        if expired:
            logger.info("Cleaned up %d expired PPT token(s).", len(expired))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_expired_tokens())
    yield
    task.cancel()


# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# For production, set FRONTEND_URL in your environment variables.
frontend_url = os.getenv("FRONTEND_URL", "*")
origins = [frontend_url] if frontend_url != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ─────────────────────────────────────────────────────────────
class PresentationRequest(BaseModel):
    title:     str        = Field(..., min_length=1, max_length=200)
    topics:    List[str]  = Field(..., min_length=1, max_length=20)
    num_slides: int       = Field(default=5, ge=2, le=15)
    context:   str        = Field(default="", max_length=5000) # Increased for doc text
    tone:      str        = Field(default="professional")
    theme:     str        = Field(default="neon")

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, v: List[str]) -> List[str]:
        sanitised = [t.strip()[:80] for t in v if t.strip()]
        if not sanitised:
            raise ValueError("At least one topic is required.")
        return sanitised

    @field_validator("tone")
    @classmethod
    def validate_tone(cls, v: str) -> str:
        allowed = {"professional", "executive", "technical", "academic", "sales", "simple"}
        return v.lower() if v.lower() in allowed else "professional"

class SlideData(BaseModel):
    title: str
    content: List[str]
    notes: Optional[str] = ""
    image_query: Optional[str] = ""
    image_base64: Optional[str] = None

class ExportRequest(BaseModel):
    title: str
    slides: List[SlideData]
    theme: str = "neon"

class RegenerateSlideRequest(BaseModel):
    title: str
    context: str
    tone: str
    existing_titles: List[str]

class RegenerateImageRequest(BaseModel):
    query: str

# ── Extraction Helper ──────────────────────────────────────────────────────────
def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    text = ""
    try:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif filename.lower().endswith(".docx"):
            doc = Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            # Assume plain text
            text = file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.error("Extraction failed for %s: %s", filename, e)
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")
    
    return text.strip()[:10000] # Cap for LLM context

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest):
    """Generate slide content + images, build PPTX, render slide previews."""
    logger.info("Generate request: title=%r, slides=%d, tone=%s, theme=%s",
                body.title, body.num_slides, body.tone, body.theme)
    try:
        # 1. Generate slide text content via LLM
        presentation_data = await generate_slide_content(
            body.title, body.topics, body.num_slides, body.context, body.tone
        )
        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        # 2. Fetch images in parallel
        image_tasks = [
            fetch_slide_image(slide.get("image_query", slide.get("title", "")))
            for slide in presentation_data
        ]
        image_bytes_list = await asyncio.gather(*image_tasks, return_exceptions=True)
        # Sanitise: replace exceptions with None
        image_bytes_list = [
            img if isinstance(img, bytes) else None
            for img in image_bytes_list
        ]

        logger.info("Images fetched: %d slides", len(presentation_data))

        # 3. Embed base64 images into each slide dict so the frontend can show them
        for slide, img_bytes in zip(presentation_data, image_bytes_list):
            if img_bytes:
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                slide["image_base64"] = f"data:image/jpeg;base64,{b64}"
            else:
                slide["image_base64"] = None

        # 4. Build the actual PPTX (with images injected)
        buf, filename = create_presentation(
            body.title, presentation_data, image_bytes_list, body.theme
        )

        # 5. Reset buffer so download endpoint can stream it
        buf.seek(0)

        # 6. Store the PPTX for future download
        token = str(uuid.uuid4())
        _ppt_store[token] = (buf, filename, time.time())

        return {
            "title":    body.title,
            "slides":   presentation_data,
            "theme":    body.theme,
            "token":    token,
            "filename": filename,
        }
    except Exception as e:
        logger.exception("Error generating presentation: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/regenerate-slide")
async def regenerate_slide(body: RegenerateSlideRequest):
    """Generate a single new slide object."""
    try:
        # We use num_slides=1 but tell the LLM to avoid existing_titles
        prompt_suffix = f"\nAvoid creating slides with these exact titles: {', '.join(body.existing_titles)}"
        new_slide_list = await generate_slide_content(
            body.title, ["New Insight"], 1, body.context + prompt_suffix, body.tone
        )
        if not new_slide_list:
            raise HTTPException(status_code=500, detail="AI failed to generate slide.")
        
        new_slide = new_slide_list[0]
        # Fetch image for new slide
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


@app.post("/regenerate-image")
async def regenerate_image(body: RegenerateImageRequest):
    """Fetch a new image for a specific query."""
    img_bytes = await fetch_slide_image(body.query)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Could not find a new image.")
    
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return {"image_base64": f"data:image/jpeg;base64,{b64}"}


@app.post("/upload-context")
async def upload_context(file: UploadFile = File(...)):
    """Extract text from PDF/DOCX to use as grounding context."""
    content = await file.read()
    text = extract_text_from_file(content, file.filename)
    return {"text": text, "filename": file.filename}


@app.post("/export")
async def export_ppt(body: ExportRequest):
    """Generate PPTX from the current (potentially edited) slides in the frontend."""
    try:
        image_bytes_list = []
        for slide in body.slides:
            if slide.image_base64 and slide.image_base64.startswith("data:image"):
                try:
                    parts = slide.image_base64.split(",")
                    if len(parts) > 1:
                        image_bytes_list.append(base64.b64decode(parts[1]))
                    else:
                        image_bytes_list.append(None)
                except:
                    image_bytes_list.append(None)
            else:
                image_bytes_list.append(None)

        slide_data_dicts = [s.model_dump() for s in body.slides]
        buf, filename = create_presentation(body.title, slide_data_dicts, image_bytes_list, body.theme)

        buf.seek(0)

        token = str(uuid.uuid4())
        _ppt_store[token] = (buf, filename, time.time())

        return {"token": token, "filename": filename}
    except Exception as e:
        logger.exception("Export failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{token}")
async def download_ppt(token: str):
    """Stream the in-memory PPTX to the client."""
    entry = _ppt_store.get(token)
    if entry is None:
        raise HTTPException(status_code=404, detail="File not found or link expired. Please regenerate.")

    buf, filename, _ = entry
    buf.seek(0)
    # _ppt_store.pop(token, None) # Keep it for multiple downloads during dev session

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
