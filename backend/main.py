import os
import io
import uuid
import time
import logging
import asyncio
import uvicorn
import base64
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Annotated, Optional, Any
from dotenv import load_dotenv
import hashlib
from bson import ObjectId
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

# Document extraction
from pypdf import PdfReader
from docx import Document

# IMPORTANT: load env vars FIRST before importing local modules
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from generator import create_presentation
from llm_client import generate_slide_content, GROQ_MODEL
from image_client import fetch_slide_image

# ── Auth & Database Config ───────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

client = AsyncIOMotorClient(MONGODB_URI)
db = client.get_database("skynet_db")
users_collection = db.get_collection("users")
presentations_collection = db.get_collection("presentations")
generation_logs_collection = db.get_collection("generation_logs")

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(
        password=plain_password.encode('utf-8'),
        hashed_password=hashed_password.encode('utf-8')
    )

def get_password_hash(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

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
    # Create unique index on email for the users collection (non-blocking)
    async def _ensure_indexes():
        try:
            await users_collection.create_index("email", unique=True)
            await presentations_collection.create_index("content_hash")
            await presentations_collection.create_index("user_id")
            logger.info("MongoDB connected — indexes ensured.")
        except Exception as e:
            logger.warning("MongoDB index creation deferred: %s", e)
    asyncio.create_task(_ensure_indexes())
    # No TTL cleanup needed anymore since we persist to DB
    yield
    task.cancel()


# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# For production, set FRONTEND_URL in your environment variables.
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [frontend_url] if frontend_url != "http://localhost:5173" else ["http://localhost:5173", "http://127.0.0.1:5173"]

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

class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if user_email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await users_collection.find_one({"email": user_email})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

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

@app.post("/auth/register")
async def register(user_data: UserRegister):
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = {
        "email": user_data.email,
        "password": hashed_password,
        "full_name": user_data.full_name,
        "created_at": datetime.utcnow()
    }
    await users_collection.insert_one(new_user)
    
    return {"message": "Registration successful"}

@app.post("/auth/login")
async def login(credentials: UserLogin):
    user = await users_collection.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"]
        }
    }


@app.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    """Generate slide content + images, and persist to MongoDB blueprint with caching."""
    start_time = time.time()
    user_id = current_user["_id"]
    
    try:
        # 1. Hashing Algorithm for Caching
        normalized_str = f"{body.title.lower().strip()}-{'|'.join(sorted([t.lower().strip() for t in body.topics]))}-{body.tone}-{body.theme}"
        content_hash = hashlib.sha256(normalized_str.encode('utf-8')).hexdigest()
        
        # 2. Check Database for Existing Presentation
        cached_presentation = await presentations_collection.find_one({"content_hash": content_hash})
        
        if cached_presentation:
            logger.info(f"Cache Hit for hash {content_hash}. Re-routing blueprint to user.")
            
            new_presentation_doc = {
                "user_id": user_id,
                "title": cached_presentation["title"],
                "topics": cached_presentation["topics"],
                "content_hash": content_hash,
                "slides": cached_presentation["slides"],
                "created_at": datetime.utcnow(),
                "theme": cached_presentation.get("theme", body.theme)
            }
            res = await presentations_collection.insert_one(new_presentation_doc)
            
            await generation_logs_collection.insert_one({
                "user_id": user_id,
                "presentation_id": res.inserted_id,
                "action": "generate",
                "status": "cache_hit",
                "execution_time_ms": int((time.time() - start_time) * 1000),
                "timestamp": datetime.utcnow()
            })
            
            return {
                "title": new_presentation_doc["title"],
                "slides": new_presentation_doc["slides"],
                "theme": cached_presentation.get("theme", body.theme),
                "token": str(res.inserted_id),
                "filename": f"{cached_presentation['title'].replace(' ', '_')}.pptx"
            }

        # 3. Cache Miss - Full Generation Pipeline
        logger.info("Cache Miss. Initiating LLM synthesis for %r", body.title)
        presentation_data = await generate_slide_content(body.title, body.topics, body.num_slides, body.context, body.tone)
        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        # 4. Fetch images in parallel
        image_tasks = [fetch_slide_image(slide.get("image_query", slide.get("title", ""))) for slide in presentation_data]
        image_bytes_list = await asyncio.gather(*image_tasks, return_exceptions=True)
        image_bytes_list = [img if isinstance(img, bytes) else None for img in image_bytes_list]

        # 5. Embed base64 images into each slide dict
        for slide, img_bytes in zip(presentation_data, image_bytes_list):
            if img_bytes:
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                slide["image_base64"] = f"data:image/jpeg;base64,{b64}"
            else:
                slide["image_base64"] = None

        # 6. Save Blueprint to MongoDB
        new_presentation_doc = {
            "user_id": user_id,
            "title": body.title,
            "topics": body.topics,
            "content_hash": content_hash,
            "slides": presentation_data,
            "created_at": datetime.utcnow(),
            "theme": body.theme
        }
        res = await presentations_collection.insert_one(new_presentation_doc)
        
        await generation_logs_collection.insert_one({
            "user_id": user_id,
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
            "filename": f"{body.title.replace(' ', '_')}.pptx"
        }
    except Exception as e:
        logger.exception("Error generating presentation: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/regenerate-slide")
async def regenerate_slide(body: RegenerateSlideRequest, current_user: Annotated[dict, Depends(get_current_user)]):
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
async def regenerate_image(body: RegenerateImageRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    """Fetch a new image for a specific query."""
    img_bytes = await fetch_slide_image(body.query)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Could not find a new image.")
    
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return {"image_base64": f"data:image/jpeg;base64,{b64}"}


@app.post("/upload-context")
async def upload_context(file: UploadFile = File(...), current_user: Annotated[dict, Depends(get_current_user)] = None):
    # Optional auth for upload-context if we want, but let's make it required for consistency
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    """Extract text from PDF/DOCX to use as grounding context."""
    content = await file.read()
    text = extract_text_from_file(content, file.filename)
    return {"text": text, "filename": file.filename}


@app.post("/export")
async def export_ppt(body: ExportRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    """Save user edits as a new presentation branch in DB and return the download token."""
    try:
        user_id = current_user["_id"]
        
        # We append a timestamp to the hash to ensure edits are saved as unique blueprints
        import time
        normalized_str = f"edited-{body.title.lower().strip()}-{time.time()}"
        content_hash = hashlib.sha256(normalized_str.encode('utf-8')).hexdigest()

        new_presentation_doc = {
            "user_id": user_id,
            "title": body.title,
            "topics": ["Edited Format"],
            "content_hash": content_hash,
            "slides": [s.model_dump() for s in body.slides],
            "created_at": datetime.utcnow(),
            "theme": body.theme
        }
        res = await presentations_collection.insert_one(new_presentation_doc)
        
        filename = f"{body.title.replace(' ', '_')}.pptx"
        
        return {
            "token": str(res.inserted_id),
            "filename": filename
        }
    except Exception as e:
        logger.exception("Export failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/presentations/me")
async def get_my_presentations(current_user: Annotated[dict, Depends(get_current_user)]):
    """Fetch all presentation blueprints owned by the user."""
    cursor = presentations_collection.find(
        {"user_id": current_user["_id"]},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1}
    ).sort("created_at", -1)
    
    presentations = await cursor.to_list(length=100)
    
    # Stringify ObjectIds for JSON serialization
    serialized = []
    for p in presentations:
        p["id"] = str(p.pop("_id"))
        p["created_at"] = p["created_at"].isoformat()
        serialized.append(p)
        
    return {"presentations": serialized}


@app.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")
        
    result = await presentations_collection.delete_one({
        "_id": obj_id,
        "user_id": current_user["_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found or unauthorized")
    
    return {"status": "success", "message": "Presentation deleted"}


@app.get("/download/{presentation_id}")
async def download_ppt(presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Dynamically build PPTX from the requested BSON blueprint."""
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID format")
        
    presentation = await presentations_collection.find_one({
        "_id": obj_id,
        "user_id": current_user["_id"]
    })
    
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found or unauthorized.")

    # Convert base64 fields back to bytes for generator.py
    image_bytes_list = []
    slides = presentation.get("slides", [])
    
    for slide in slides:
        img_b64 = slide.get("image_base64")
        if img_b64 and img_b64.startswith("data:image"):
            try:
                parts = img_b64.split(",")
                if len(parts) > 1:
                    image_bytes_list.append(base64.b64decode(parts[1]))
                else:
                    image_bytes_list.append(None)
            except:
                image_bytes_list.append(None)
        else:
            image_bytes_list.append(None)

    # Reconstruct presentation on the fly
    buf, filename = create_presentation(
        presentation.get("title", "Untitled"),
        slides, 
        image_bytes_list, 
        presentation.get("theme", "neon")
    )

    buf.seek(0)

    # Allow custom extension matching
    if not filename.endswith(".pptx"):
        filename += ".pptx"
    
    # Safe filename
    safe_filename = filename.replace(" ", "_").replace("/", "-")

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
