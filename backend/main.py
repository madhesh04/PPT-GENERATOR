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

import sys
import os
# Ensure the backend directory is in the path for module discovery when run from root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# IMPORTANT: load env vars FIRST before importing local modules
from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from generator import create_presentation
from pdf_generator import create_pdf_presentation
from llm_client import generate_slide_content, GROQ_MODEL, is_technical_topic, NVIDIA_MODEL, nvidia_client
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
settings_collection = db.get_collection("settings")

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


# ── Master Account ─────────────────────────────────────────────────────────────
MASTER_EMAIL = "admin@skynet.ai"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create unique index on email for the users collection (non-blocking)
    async def _ensure_indexes():
        try:
            await users_collection.create_index("email", unique=True)
            await presentations_collection.create_index("content_hash")
            await presentations_collection.create_index("user_id")
            # Ensure all existing users have a status field
            await users_collection.update_many(
                {"status": {"$exists": False}},
                {"$set": {"status": "active"}}
            )
            # Initialize global settings if they don't exist
            global_settings = await settings_collection.find_one({"id": "global_config"})
            if not global_settings:
                # Defaults: Groq as model, both images and notes ON
                await settings_collection.insert_one({
                    "id": "global_config",
                    "image_generation_enabled": True,
                    "speaker_notes_enabled": True,
                    "default_model": "groq"
                })
            else:
                # Backfill missing fields for existing configurations
                updates = {}
                if "speaker_notes_enabled" not in global_settings:
                    updates["speaker_notes_enabled"] = True
                if "default_model" not in global_settings:
                    updates["default_model"] = "groq"
                if updates:
                    await settings_collection.update_one({"id": "global_config"}, {"$set": updates})
            logger.info("MongoDB connected — indexes/settings ensured.")
        except Exception as e:
            logger.warning("MongoDB index creation deferred: %s", e)
    asyncio.create_task(_ensure_indexes())
    asyncio.create_task(_cleanup_expired_tokens())
    yield


# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# For production, set FRONTEND_URL in your environment variables.
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
if "," in frontend_url:
    origins = [o.strip().rstrip("/") for o in frontend_url.split(",") if o.strip()]
else:
    origins = [frontend_url.rstrip("/")] if frontend_url.rstrip("/") != "http://localhost:5173" else ["http://localhost:5173", "http://127.0.0.1:5173"]

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
    force_provider: str | None = Field(default=None)  # "nvidia" | "groq" | None (auto)

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
    code: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = ""
    image_query: Optional[str] = None
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
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    email: str
    password: str
    login_as: str

class AdminCreateUser(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "user"

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    
    token = auth_header.split(" ")[1]
    try:
        # Load without DB lookup to rely on JWT role
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if "sub" not in payload or "role" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: Annotated[dict, Depends(get_current_user)]):
    role = current_user.get("role", "USER").upper()
    if role not in ["ADMIN", "MASTER"]:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED — Insufficient privileges")
    return current_user

async def require_master(current_user: Annotated[dict, Depends(get_current_user)]):
    if current_user.get("sub") != MASTER_EMAIL:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED — Master privileges required")
    return current_user

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
    return {
        "status": "ok",
        "model": GROQ_MODEL,
        "nvidia_nim": {
            "available": nvidia_client is not None,
            "model": NVIDIA_MODEL if nvidia_client else None,
        },
    }

@app.post("/auth/register")
async def register(user_data: UserRegister):
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    hashed_password = get_password_hash(user_data.password)
    requested_role = user_data.role if user_data.role in ["user", "admin"] else "user"
    # Admin registrations go to pending; users are immediately active
    status = "pending" if requested_role == "admin" else "active"
    
    new_user = {
        "email": user_data.email,
        "password": hashed_password,
        "full_name": user_data.full_name,
        "role": requested_role,
        "status": status,
        "created_at": datetime.utcnow()
    }
    await users_collection.insert_one(new_user)
    
    if status == "pending":
        return {"message": "Admin registration submitted. Awaiting master approval."}
    return {"message": "Registration successful"}

@app.post("/auth/login")
async def login(credentials: UserLogin):
    logger.info("Login attempt for %s (claimed: %s)", credentials.email, credentials.login_as)
    user = await users_collection.find_one({"email": credentials.email})
    if not user:
        logger.warning("Login failed: User %s not found", credentials.email)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")
    
    if not verify_password(credentials.password, user["password"]):
        logger.warning("Login failed: Incorrect password for %s", credentials.email)
        raise HTTPException(status_code=401, detail="AUTHENTICATION_FAILED — Invalid credentials")
    
    # 1. Normalize and compare DB role against claimed role
    # Frontend sends 'employee' for regular user login
    claimed_role = "user" if credentials.login_as == "employee" else credentials.login_as
    db_role = user.get("role", "user").lower()
    
    # Allow hierarchical access: Admin/Master can login as a regular user
    is_authorized = False
    if claimed_role == "user":
        is_authorized = True # All authenticated accounts can access the 'user' view
    elif claimed_role == "admin":
        if db_role in ["admin", "master"]:
            is_authorized = True
    elif claimed_role == "master":
        if db_role == "master":
            is_authorized = True
            
    if not is_authorized:
        raise HTTPException(
            status_code=403, 
            detail=f"ACCESS_DENIED — Account role '{db_role}' is insufficient for '{claimed_role}' access"
        )
    
    # 2. Check account status if logging in as admin
    if db_role == "admin":
        user_status = user.get("status", "active")
        if user_status == "pending":
            raise HTTPException(status_code=403, detail="ACCESS_PENDING — Awaiting master account approval")
        if user_status == "rejected":
            raise HTTPException(status_code=403, detail="ACCESS_REJECTED — Account access has been denied")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Generate token WITH embedded role and status mapping per spec
    payload_data = {
        "sub": user["email"],
        "user_id": str(user["_id"]),
        "username": user["full_name"],
        "role": db_role.upper(),
        "status": user.get("status", "active").upper()
    }
    access_token = create_access_token(
        data=payload_data, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "full_name": user["full_name"],
            "role": db_role.upper()
        }
    }


@app.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    """Generate slide content + images, and persist to MongoDB blueprint with caching."""
    start_time = time.time()
    user_id = ObjectId(current_user["user_id"])
    
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
                "user_id": current_user.get("user_id"),
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

        # 4. Fetch images in parallel (only for slides that have an image_query)
        # Check global system settings (images, notes, model)
        global_config = await settings_collection.find_one({"id": "global_config"})
        if not global_config:
            global_config = {"image_generation_enabled": True, "speaker_notes_enabled": True, "default_model": "groq"}

        images_enabled = global_config.get("image_generation_enabled", True)
        notes_enabled = global_config.get("speaker_notes_enabled", True)
        default_model_choice = global_config.get("default_model", "groq")

        # 3. Cache Miss - Full Generation Pipeline
        logger.info("Cache Miss. Initiating LLM synthesis for %r", body.title)
        presentation_data, model_used, provider = await generate_slide_content(
            body.title, body.topics, body.num_slides, body.context, body.tone,
            force_provider=body.force_provider or default_model_choice,
            include_notes=notes_enabled
        )
        if not presentation_data:
            raise HTTPException(status_code=500, detail="Failed to generate slide content from AI.")

        async def _maybe_fetch_image(slide):
            if not images_enabled:
                return None
            query = slide.get("image_query")
            if query:
                return await fetch_slide_image(query)
            return None

        image_tasks = [_maybe_fetch_image(slide) for slide in presentation_data]
        image_bytes_list = await asyncio.gather(*image_tasks, return_exceptions=True)
        image_bytes_list = [img if isinstance(img, bytes) else None for img in image_bytes_list]

        # 5. Embed base64 images into each slide dict
        for slide, img_bytes in zip(presentation_data, image_bytes_list):
            if img_bytes:
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                slide["image_base64"] = f"data:image/jpeg;base64,{b64}"
            else:
                slide["image_base64"] = None

        # 6. Save Blueprint to MongoDB (Strip images to save space)
        db_slides = []
        for s in presentation_data:
            s_copy = s.copy()
            s_copy["image_base64"] = None
            db_slides.append(s_copy)

        new_presentation_doc = {
            "user_id": ObjectId(current_user.get("user_id")) if current_user.get("user_id") else None,
            "username": current_user.get("username", "Unknown"),
            "title": body.title,
            "topics": body.topics,
            "content_hash": content_hash,
            "slides": db_slides,
            "created_at": datetime.utcnow(),
            "theme": body.theme
        }
        res = await presentations_collection.insert_one(new_presentation_doc)
        
        await generation_logs_collection.insert_one({
            "user_id": current_user.get("user_id"),
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
            "provider": provider,
            "is_technical": is_technical_topic(body.title, body.topics),
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
        new_slide_list, _, _ = await generate_slide_content(
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
    # Check global image generation setting
    global_config = await settings_collection.find_one({"id": "global_config"})
    if global_config and not global_config.get("image_generation_enabled", True):
        raise HTTPException(status_code=403, detail="IMAGE_GENERATION_DISABLED_GLOBALLY")

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


@app.post("/export-pdf")
async def export_pdf(req: ExportRequest, user: Annotated[dict, Depends(get_current_user)]):
    try:
        pdf_io = create_pdf_presentation(req.title, [s.model_dump() for s in req.slides], req.theme)
        # Unique timestamped filename
        fn = f"{req.title.replace(' ', '_')}_{int(time.time())}.pdf"
        return StreamingResponse(
            pdf_io,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={fn}"}
        )
    except Exception as e:
        logger.error("PDF Export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"PDF_EXPORT_FAILED: {str(e)}")


@app.post("/export-pptx")
async def export_ppt(body: ExportRequest, current_user: Annotated[dict, Depends(get_current_user)]):
    """Save user edits as a new presentation branch in DB and return the download token."""
    try:
        user_id = ObjectId(current_user["user_id"])
        
        # We append a timestamp to the hash to ensure edits are saved as unique blueprints
        import time
        normalized_str = f"edited-{body.title.lower().strip()}-{time.time()}"
        content_hash = hashlib.sha256(normalized_str.encode('utf-8')).hexdigest()

        # Strip images before saving edited blueprint to DB
        db_slides = []
        for s in body.slides:
            s_dict = s.model_dump()
            s_dict["image_base64"] = None
            db_slides.append(s_dict)

        new_presentation_doc = {
            "user_id": user_id,
            "title": body.title,
            "topics": ["Edited Format"],
            "content_hash": content_hash,
            "slides": db_slides,
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
        {"user_id": ObjectId(current_user["user_id"])},
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


# ── Admin Endpoints ────────────────────────────────────────────────────────────

@app.get("/admin/stats")
async def admin_get_stats(admin_user: Annotated[dict, Depends(require_admin)]):
    total_users = await users_collection.count_documents({})
    total_generations = await presentations_collection.count_documents({})
    pending_approvals = await users_collection.count_documents({"status": "pending"})
    
    yesterday = datetime.utcnow() - timedelta(days=1)
    active_today = await presentations_collection.aggregate([
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "active_users"}
    ]).to_list(length=1)
    active_count = active_today[0]["active_users"] if active_today else 0
    
    return {
        "total_users": total_users,
        "total_generations": total_generations,
        "pending_approvals": pending_approvals,
        "active_today": active_count
    }

@app.get("/admin/generations")
async def admin_get_all_presentations(admin_user: Annotated[dict, Depends(require_admin)]):
    """Fetch all presentation blueprints globally for admin."""
    cursor = presentations_collection.aggregate([
        {
            "$project": {
                "_id": 1, 
                "title": 1, 
                "theme": 1, 
                "created_at": 1,
                "username": {"$ifNull": ["$username", "Unknown"]},
                "slides_count": {"$size": {"$ifNull": ["$slides", []]}}
            }
        },
        {"$sort": {"created_at": -1}}
    ])
    
    presentations = await cursor.to_list(length=500)
    
    serialized = []
    for p in presentations:
        p["id"] = str(p.pop("_id"))
        p["generated_by"] = p.pop("username")
        p["slides"] = p.pop("slides_count")
        p["tone"] = "Professional" # Stub tone since not stored explicitly
        p["status"] = "COMPLETE"
        if "created_at" in p:
            p["created_at"] = p["created_at"].isoformat()
        serialized.append(p)
        
    return {"presentations": serialized}

@app.delete("/admin/generations/{presentation_id}")
async def admin_delete_presentation(presentation_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")
        
    result = await presentations_collection.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    return {"status": "success"}

@app.get("/admin/users")
async def admin_get_users(admin_user: Annotated[dict, Depends(require_admin)]):
    """List all registered users with aggregated stats."""
    cursor = users_collection.aggregate([
        {"$project": {"password": 0}},
        {
            "$lookup": {
                "from": "presentations",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "presentations"
            }
        },
        {
            "$addFields": {
                "ppt_count": {"$size": "$presentations"}
            }
        },
        {"$project": {"presentations": 0}},
        {"$sort": {"created_at": -1}}
    ])
    users = await cursor.to_list(length=500)
    
    serialized = []
    for u in users:
        u["id"] = str(u.pop("_id"))
        if "created_at" in u:
            u["created_at"] = u["created_at"].isoformat()
        u.setdefault("status", "active")
        u.setdefault("role", "user")
        serialized.append(u)
        
    return {"users": serialized}

@app.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, payload: dict, admin_user: Annotated[dict, Depends(require_admin)]):
    role = payload.get("role")
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    result = await users_collection.update_one({"_id": obj_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "role": role}

@app.get("/admin/users/{user_id}/ppts")
async def admin_get_user_presentations(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    """Fetch all presentations for a specific user ID."""
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    cursor = presentations_collection.find(
        {"user_id": obj_id},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "username": 1}
    ).sort("created_at", -1)
    
    ppts = await cursor.to_list(length=200)
    serialized = []
    for p in ppts:
        p["id"] = str(p.pop("_id"))
        p["created_at"] = p["created_at"].isoformat()
        serialized.append(p)
        
    return {"presentations": serialized}

@app.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, payload: dict, admin_user: Annotated[dict, Depends(require_admin)]):
    """Update user account status (active, suspended)."""
    status = payload.get("status")
    if status not in ["active", "suspended", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status specified")
        
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    result = await users_collection.update_one({"_id": obj_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "user_status": status}

@app.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_user: Annotated[dict, Depends(require_admin)]):
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
        
    if admin_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    # Delete user's presentations first
    await presentations_collection.delete_many({"user_id": obj_id})
    # Delete the user
    result = await users_collection.delete_one({"_id": obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success"}


@app.post("/admin/users/create")
async def admin_create_user(body: AdminCreateUser, admin_user: Annotated[dict, Depends(require_admin)]):
    """Admin creates a new user account."""
    existing = await users_collection.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    role = body.role if body.role in ["user", "admin"] else "user"
    # Admin-created users with role=user are immediately active
    # Admin-created admins still need master approval unless creator IS the master
    if role == "admin" and admin_user.get("sub") != MASTER_EMAIL:
        status = "pending"
    else:
        status = "active"
    
    new_user = {
        "email": body.email,
        "password": get_password_hash(body.password),
        "full_name": body.full_name,
        "role": role,
        "status": status,
        "created_at": datetime.utcnow()
    }
    await users_collection.insert_one(new_user)
    
    return {"status": "success", "message": f"Account created with status: {status}"}


@app.get("/admin/pending")
async def admin_get_pending(master_user: Annotated[dict, Depends(require_master)]):
    """List all pending admin approval requests (master only)."""
    cursor = users_collection.find(
        {"status": "pending"},
        {"password": 0}
    ).sort("created_at", -1)
    pending = await cursor.to_list(length=100)
    
    serialized = []
    for u in pending:
        u["id"] = str(u.pop("_id"))
        if "created_at" in u:
            u["created_at"] = u["created_at"].isoformat()
        serialized.append(u)
        
    return {"pending": serialized}


@app.post("/admin/approve/{user_id}")
async def admin_approve_user(user_id: str, master_user: Annotated[dict, Depends(require_master)]):
    """Master approves a pending admin account."""
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await users_collection.update_one(
        {"_id": obj_id, "status": "pending"},
        {"$set": {"status": "active"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"status": "success", "message": "User approved and activated"}


@app.post("/admin/reject/{user_id}")
async def admin_reject_user(user_id: str, master_user: Annotated[dict, Depends(require_master)]):
    """Master rejects a pending admin account."""
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await users_collection.update_one(
        {"_id": obj_id, "status": "pending"},
        {"$set": {"status": "rejected"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    return {"status": "success", "message": "User rejected"}


@app.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
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


@app.get("/download/{presentation_id}")
async def download_ppt(presentation_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Dynamically build PPTX from the requested BSON blueprint."""
    try:
        obj_id = ObjectId(presentation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid presentation ID format")
        
    # Admins can download any presentation; regular users only their own
    user_role = current_user.get("role", "user").upper()
    if user_role in ("ADMIN", "MASTER"):
        presentation = await presentations_collection.find_one({"_id": obj_id})
    else:
        presentation = await presentations_collection.find_one({
            "_id": obj_id,
            "user_id": ObjectId(current_user["user_id"])
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

@app.get("/admin/settings")
async def admin_get_settings(admin_user: Annotated[dict, Depends(require_admin)]):
    """Fetch global application settings."""
    config = await settings_collection.find_one({"id": "global_config"})
    if not config:
        return {
            "image_generation_enabled": True,
            "speaker_notes_enabled": True,
            "default_model": "groq"
        }
    return {
        "image_generation_enabled": config.get("image_generation_enabled", True),
        "speaker_notes_enabled": config.get("speaker_notes_enabled", True),
        "default_model": config.get("default_model", "groq")
    }

@app.patch("/admin/settings")
async def admin_update_settings(payload: dict, admin_user: Annotated[dict, Depends(require_admin)]):
    """Update global application settings."""
    updates = {}
    if "image_generation_enabled" in payload:
        updates["image_generation_enabled"] = payload["image_generation_enabled"]
    if "speaker_notes_enabled" in payload:
        updates["speaker_notes_enabled"] = payload["speaker_notes_enabled"]
    if "default_model" in payload:
        updates["default_model"] = payload["default_model"]
        
    if not updates:
        raise HTTPException(status_code=400, detail="No valid settings to update")
        
    await settings_collection.update_one(
        {"id": "global_config"},
        {"$set": updates},
        upsert=True
    )
    return {"status": "success", "settings": updates}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
