import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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

# Serve generated files
os.makedirs("generated_ppts", exist_ok=True)
app.mount("/files", StaticFiles(directory="generated_ppts"), name="files")

class PresentationRequest(BaseModel):
    title: str
    topics: List[str]
    num_slides: int = Field(default=5, ge=2, le=15)
    context: str = Field(default="")
    tone: str = Field(default="professional")

@app.post("/generate")
async def generate_ppt(request: PresentationRequest):
    """Generate slide content + PPTX and return slide data for preview."""
    try:
        # 1. Generate Content via LLM
        presentation_data = await generate_slide_content(request.title, request.topics, request.num_slides, request.context, request.tone)

        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        # 2. Create PPTX file
        file_path = create_presentation(request.title, presentation_data)
        safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in request.title)
        filename = f"{safe_title.replace(' ', '_')}.pptx"

        # 3. Return slide data for preview + filename for download
        return {
            "title": request.title,
            "slides": presentation_data,
            "filename": filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{filename}")
async def download_ppt(filename: str):
    """Download a previously generated PPTX file."""
    file_path = os.path.join("generated_ppts", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
