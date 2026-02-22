import io
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv

# IMPORTANT: load env vars FIRST before importing local modules
load_dotenv()

from generator import create_presentation
from llm_client import generate_slide_content

app = FastAPI()

# Allow frontend (port 5173) to call backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store: { token: (BytesIO, filename) }
# Each entry is ephemeral — lives only for the duration of one download.
_ppt_store: dict[str, tuple[io.BytesIO, str]] = {}


class PresentationRequest(BaseModel):
    title: str
    topics: List[str]
    num_slides: int = Field(default=5, ge=2, le=15)
    context: str = Field(default="")
    tone: str = Field(default="professional")


@app.post("/generate")
async def generate_ppt(request: PresentationRequest):
    """Generate slide content + PPTX in memory; return slide data + download token."""
    try:
        # 1. Generate content via LLM
        presentation_data = await generate_slide_content(
            request.title, request.topics, request.num_slides, request.context, request.tone
        )

        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        # 2. Build PPTX entirely in memory (no disk writes)
        buf, filename = create_presentation(request.title, presentation_data)

        # 3. Store buffer under a one-time token
        token = str(uuid.uuid4())
        _ppt_store[token] = (buf, filename)

        return {
            "title": request.title,
            "slides": presentation_data,
            "filename": filename,
            "token": token,        # frontend uses this to download
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{token}")
async def download_ppt(token: str):
    """Stream the in-memory PPTX directly to the client, then discard it."""
    entry = _ppt_store.pop(token, None)   # remove after first download
    if entry is None:
        raise HTTPException(status_code=404, detail="File not found or already downloaded.")

    buf, filename = entry
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
