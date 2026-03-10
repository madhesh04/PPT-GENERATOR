import io
import uuid
import time
import logging
import asyncio
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Annotated
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# IMPORTANT: load env vars FIRST before importing local modules
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from backend.generator import create_presentation
from backend.llm_client import generate_slide_content, GROQ_MODEL

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ─────────────────────────────────────────────────────────────
class PresentationRequest(BaseModel):
    title:     str        = Field(..., min_length=1, max_length=200)
    topics:    List[str]  = Field(..., min_length=1, max_length=20)
    num_slides: int       = Field(default=5, ge=2, le=15)
    context:   str        = Field(default="", max_length=500)
    tone:      str        = Field(default="professional")

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


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest):
    """Generate slide content + PPTX in memory; return slide data + download token."""
    logger.info("Generate request: title=%r, slides=%d, tone=%s",
                body.title, body.num_slides, body.tone)
    try:
        presentation_data = await generate_slide_content(
            body.title, body.topics, body.num_slides, body.context, body.tone
        )

        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        buf, filename = create_presentation(body.title, presentation_data)

        token = str(uuid.uuid4())
        _ppt_store[token] = (buf, filename, time.time())

        logger.info("PPT generated: filename=%s, token=%s", filename, token)
        return {
            "title":    body.title,
            "slides":   presentation_data,
            "filename": filename,
            "token":    token,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error generating presentation: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{token}")
async def download_ppt(token: str):
    """Stream the in-memory PPTX to the client.
    Token remains valid for PPT_TTL seconds (5 min) after generation.
    """
    entry = _ppt_store.get(token)
    if entry is None:
        raise HTTPException(status_code=404, detail="File not found or link expired. Please regenerate.")

    buf, filename, _ = entry
    buf.seek(0)

    # Remove after serving (one-time download)
    _ppt_store.pop(token, None)

    logger.info("Serving download: %s", filename)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
