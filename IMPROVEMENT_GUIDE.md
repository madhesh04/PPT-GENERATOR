# Skynet PPT Generator — Comprehensive Improvement Guide
> Domains: Architecture · Backend · Frontend · ML/AI Engineering
> Based on actual codebase analysis — every recommendation is specific to YOUR code.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 1 — ARCHITECTURE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Current State
Monolithic FastAPI backend in a single 900-line `main.py`. No service layer, no repository pattern, no dependency injection for config. Frontend is a single-component SPA.

---

## A1. Migrate to a Layered Architecture (Most Important)

**Current (wrong):**
```
backend/main.py  ← everything: routes + auth + DB + models + business logic
```

**Target structure:**
```
backend/
├── main.py                  ← ONLY: app init, lifespan, middleware, router mounts
├── core/
│   ├── config.py            ← pydantic-settings: all env vars typed + validated
│   ├── security.py          ← JWT encode/decode, bcrypt helpers
│   └── dependencies.py      ← get_current_user, require_admin, require_master
├── db/
│   ├── client.py            ← Motor client, one place
│   └── repositories/
│       ├── user_repo.py     ← find_by_email, create, update_status, etc.
│       ├── ppt_repo.py      ← find_by_hash, insert_blueprint, find_by_user
│       └── log_repo.py      ← insert_generation_log
├── routers/
│   ├── auth.py              ← /auth/register, /auth/login
│   ├── generate.py          ← /generate, /regenerate-slide, /regenerate-image
│   ├── export.py            ← /export-pptx, /export-pdf
│   ├── presentations.py     ← /presentations/me, /presentations/{id}
│   ├── upload.py            ← /upload-context
│   └── admin.py             ← all /admin/* routes
├── services/
│   ├── generation_service.py   ← orchestrates LLM + image + cache logic
│   ├── export_service.py       ← PPTX / PDF creation logic
│   └── storage_service.py      ← PPT file store (Redis/GridFS abstraction)
├── models/
│   ├── requests.py          ← all Pydantic input models
│   └── responses.py         ← all Pydantic output models
└── shared/
    └── themes.py            ← single THEMES dict (remove duplication)
```

**How to implement `core/config.py` right now (30 min effort, huge payoff):**
```python
# backend/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    mongodb_uri: str
    jwt_secret: str
    groq_api_key: str
    nvidia_api_key: str = ""
    unsplash_access_key: str = ""
    freepik_api_key: str = ""
    pollinations_api_key: str = ""
    frontend_url: str = "http://localhost:5173"
    master_email: str = "admin@skynet.ai"
    access_token_expire_minutes: int = 1440
    ppt_ttl_seconds: int = 300

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

This gives you:
- Type-safe config everywhere
- Auto-validation on startup (missing JWT_SECRET = hard crash, not silent failure)
- No more `os.getenv("X", "dangerous-default")` scattered across the file

---

## A2. Replace In-Memory PPT Store with MongoDB GridFS

**Why:** The current `_ppt_store` dict doesn't work with `gunicorn --workers N`. Worker 1 generates and stores the file; the download request hits Worker 3 → 404.

**Implementation (drop-in replacement):**

```python
# backend/services/storage_service.py
import io
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from db.client import get_db

async def store_ppt(file_bytes: bytes, filename: str, presentation_id: str) -> str:
    """Store PPTX in GridFS. Returns the file_id string."""
    db = get_db()
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="pptx_files")
    stream = io.BytesIO(file_bytes)
    file_id = await bucket.upload_from_stream(
        filename,
        stream,
        metadata={"presentation_id": presentation_id}
    )
    return str(file_id)

async def retrieve_ppt(file_id: str) -> tuple[bytes, str] | None:
    """Retrieve PPTX from GridFS. Returns (bytes, filename) or None."""
    from bson import ObjectId
    db = get_db()
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="pptx_files")
    try:
        stream = io.BytesIO()
        grid_out = await bucket.open_download_stream(ObjectId(file_id))
        await grid_out.read(size=-1)  # motor: use gridout directly
        return grid_out, grid_out.filename
    except Exception:
        return None

async def cleanup_old_files(older_than_seconds: int = 300):
    """TTL cleanup — run as a background task."""
    from datetime import datetime, timedelta
    db = get_db()
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="pptx_files")
    cutoff = datetime.utcnow() - timedelta(seconds=older_than_seconds)
    cursor = bucket.find({"uploadDate": {"$lt": cutoff}})
    async for grid_out in cursor:
        await bucket.delete(grid_out._id)
```

---

## A3. Add an Async Task Queue for Long-Running Generation

**Problem:** `/generate` makes 3+ external API calls (LLM + images). A user waits 20–60 seconds on a blocking HTTP request. If they close the browser tab, the generation is wasted.

**Target pattern — Background Jobs with status polling:**

```
POST /generate
  → creates a Job record in MongoDB (status: "queued")
  → returns { job_id: "..." } immediately (200ms response)
  → background task runs: LLM → images → store result

GET /jobs/{job_id}
  → returns { status: "running" | "complete" | "failed", result?: {...} }

Frontend: polls every 2s → shows progress bar → gets result when done
```

**Minimal implementation using FastAPI BackgroundTasks (no extra infra):**
```python
# routers/generate.py
from fastapi import BackgroundTasks

@router.post("/generate")
async def generate_ppt(body: PresentationRequest, background_tasks: BackgroundTasks, ...):
    job_id = str(uuid.uuid4())
    await jobs_collection.insert_one({"_id": job_id, "status": "queued", "created_at": datetime.utcnow()})
    background_tasks.add_task(run_generation_job, job_id, body, current_user)
    return {"job_id": job_id, "status": "queued"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, current_user: ...):
    job = await jobs_collection.find_one({"_id": job_id})
    if not job:
        raise HTTPException(404)
    return job
```

For production scale: swap `BackgroundTasks` for **Celery + Redis** or **ARQ** (async Redis Queue) — both integrate cleanly with FastAPI.

---

## A4. Architecture Diagram (Current vs Target)

**Current:**
```
Browser → Vercel CDN → [React SPA]
               ↓ fetch (JWT in localStorage)
          [FastAPI main.py — 900 LOC]
               ↓              ↓
          [MongoDB]      [Groq / NVIDIA / Unsplash / Pollinations]
```

**Target:**
```
Browser → Vercel CDN → [React SPA — view-split, Zustand, React Router]
               ↓ fetch (httpOnly JWT cookie)
          [FastAPI — routers + services + repos]
               ↓              ↓              ↓
          [MongoDB]      [Redis / GridFS]  [LLM APIs / Image APIs]
               ↑                              ↑
         [ARQ Worker] ←— job queue ←— /generate returns job_id
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 2 — BACKEND
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## B1. Fix the Cache Key Bug (5 minutes, critical)

**Current bug — `num_slides` and `context` are excluded from the hash:**
```python
# main.py line 400
normalized_str = f"{body.title.lower().strip()}-{'|'.join(sorted([t.lower().strip() for t in body.topics]))}-{body.tone}-{body.theme}"
```

A user generating 5 slides then 10 slides on "Machine Learning" gets a cache hit → receives 5 slides when they asked for 10.

**Fix:**
```python
import hashlib

context_hash = hashlib.md5(body.context.strip().encode()).hexdigest()[:8]  # short, deterministic
normalized_str = (
    f"{body.title.lower().strip()}"
    f"-{'|'.join(sorted(t.lower().strip() for t in body.topics))}"
    f"-{body.tone}-{body.theme}"
    f"-slides{body.num_slides}"
    f"-ctx{context_hash}"
)
content_hash = hashlib.sha256(normalized_str.encode()).hexdigest()
```

---

## B2. Add Request Timeout to All External Calls

**Current — LLM calls can hang forever:**
```python
slides = await asyncio.to_thread(_call_groq, ...)  # no timeout
```

**Fix — wrap with `asyncio.wait_for`:**
```python
# services/generation_service.py
import asyncio

LLM_TIMEOUT = 45.0  # seconds
IMAGE_TIMEOUT = 20.0

try:
    slides = await asyncio.wait_for(
        asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone),
        timeout=LLM_TIMEOUT
    )
except asyncio.TimeoutError:
    logger.error("LLM call timed out after %ss", LLM_TIMEOUT)
    raise HTTPException(status_code=504, detail="AI generation timed out. Please try again.")
```

---

## B3. Add Pagination to Admin Endpoints

**Current — OOM risk with large datasets:**
```python
await cursor.to_list(length=500)  # 500 presentations = potentially 50MB+ of JSON
```

**Fix — add skip/limit query params:**
```python
# routers/admin.py
from fastapi import Query

@router.get("/admin/generations")
async def admin_get_all_presentations(
    admin_user: ...,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200)
):
    skip = (page - 1) * limit
    total = await presentations_collection.count_documents({})
    cursor = presentations_collection.aggregate([
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "username": 1}}
    ])
    items = await cursor.to_list(length=limit)
    return {
        "presentations": serialize(items),
        "total": total,
        "page": page,
        "pages": -(-total // limit)  # ceiling division
    }
```

---

## B4. Add Proper Input Validation for Admin Payloads

**Current — untyped `dict` for admin endpoints:**
```python
async def admin_update_user_role(user_id: str, payload: dict, ...):
    role = payload.get("role")  # no validation, no type safety
```

**Fix — Pydantic models for every request body:**
```python
# models/requests.py
class UpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]

class UpdateStatusRequest(BaseModel):
    status: Literal["active", "suspended", "pending"]

class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)

# router
@router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, body: UpdateRoleRequest, ...):
    ...
```

---

## B5. Add Token Revocation Check for Sensitive Routes

**Current — deleted/suspended users can use old tokens for 24 hours:**
```python
# get_current_user: decodes JWT only, never hits DB
payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
return payload  # suspended user still gets in
```

**Fix — DB lookup for admin/sensitive routes only (use sparingly for performance):**
```python
async def get_current_user_verified(request: Request, db=Depends(get_db)):
    """Like get_current_user but also verifies account status in DB."""
    payload = await get_current_user(request)  # JWT decode first
    user = await db.users.find_one({"email": payload["sub"]})
    if not user:
        raise HTTPException(401, "User account not found")
    if user.get("status") not in ("active",):
        raise HTTPException(403, f"Account is {user.get('status', 'inactive')}")
    return payload

# Use the verified version only on admin routes and generate:
@router.post("/generate")
async def generate_ppt(..., current_user = Depends(get_current_user_verified)):
    ...
```

---

## B6. Fix the Tone/TONE_CONFIG Mismatch

**Current bug — validator allows tones the LLM config doesn't know about:**
```python
# Validator allows: professional, executive, technical, academic, sales, simple
# TONE_CONFIG only has: professional, creative, technical, educational
# Result: "executive" silently becomes "professional" without logging
```

**Fix — align both maps, add a log when fallback occurs:**
```python
# llm_client.py
TONE_CONFIG = {
    "professional": {...},
    "executive":    {"temperature": 0.4, "instruction": "Write for C-suite. Be strategic, data-driven, outcome-focused. Use business metrics."},
    "technical":    {...},
    "educational":  {...},
    "academic":     {"temperature": 0.4, "instruction": "Use scholarly tone. Cite principles, use precise terminology. Suitable for academic audiences."},
    "sales":        {"temperature": 0.7, "instruction": "Persuasive and value-focused. Lead with benefits, use social proof, drive towards action."},
    "simple":       {"temperature": 0.6, "instruction": "Plain English. Short sentences. No jargon. Accessible to general audiences."},
    "creative":     {...},
}
```

---

## B7. Add Structured Logging and Request Tracing

**Current:** Raw `logging.basicConfig` with no correlation IDs. When 100 users generate simultaneously, logs are interleaved and impossible to trace.

**Fix — add a request ID middleware:**
```python
# core/middleware.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

# main.py
app.add_middleware(RequestIDMiddleware)
```

Then in generation logs:
```python
logger.info("[%s] Generating for user %s: %r", request.state.request_id, user_id, body.title)
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 3 — FRONTEND
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## F1. Split App.tsx into Route-Based Views (Most Urgent)

**Current — 9 views in one component with a string state flag:**
```tsx
const [view, setView] = useState<'dashboard'|'create'|'preview'|'history'|'settings'|'admin_panel'|...>('dashboard');
```

This means ALL 9 views are in one render tree, all state lives at the top, and any change re-renders everything.

**Fix — install React Router and split views:**
```bash
npm install react-router-dom
```

```tsx
// src/main.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

root.render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreatePresentation />} />
          <Route path="/preview" element={<SlidePreview />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/pending" element={<PendingApprovals />} />
          <Route path="/admin/generations" element={<GlobalGenerations />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
```

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth';

export function ProtectedRoute({ requiredRole }: { requiredRole?: string }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

---

## F2. Extract All API Calls into a Typed API Client

**Current — fetch calls scattered across App.tsx with no error handling standard:**
```tsx
// Somewhere in a 26K-token file...
const res = await fetch(`${API_BASE}/generate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
```

**Fix — centralized typed API client:**
```ts
// src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8001';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token'); // temporary until httpOnly cookies
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? 'Unknown error');
  }
  return res.json();
}

// src/api/presentations.ts
import { request } from './client';
import type { GenerateResponse, PresentationRequest, SlideData } from '../types';

export const api = {
  generate: (body: PresentationRequest) =>
    request<GenerateResponse>('/generate', { method: 'POST', body: JSON.stringify(body) }),

  exportPptx: (body: { title: string; slides: SlideData[]; theme: string }) =>
    request<{ token: string; filename: string }>('/export-pptx', { method: 'POST', body: JSON.stringify(body) }),

  getMyPresentations: () =>
    request<{ presentations: SavedPresentation[] }>('/presentations/me'),

  regenerateSlide: (body: RegenerateSlideRequest) =>
    request<SlideData>('/regenerate-slide', { method: 'POST', body: JSON.stringify(body) }),
};
```

---

## F3. Move State Into Custom Hooks per View

**Current — ~40 `useState` calls at the App level:**
```tsx
const [title, setTitle] = useState('');
const [topics, setTopics] = useState<string[]>([]);
const [topicIn, setTopicIn] = useState('');
const [context, setContext] = useState('');
const [tone, setTone] = useState('professional');
// ... 35 more
```

**Fix — co-locate state with the view that owns it:**
```ts
// src/hooks/usePresentation.ts
import { useState, useCallback } from 'react';
import { api } from '../api/presentations';
import type { GenerateResponse, PresentationRequest } from '../types';

export function usePresentation() {
  const [form, setForm] = useState<PresentationRequest>({
    title: '', topics: [], num_slides: 5,
    context: '', tone: 'professional', theme: 'neon',
  });
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.generate(form);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  return { form, setForm, result, loading, error, generate };
}
```

---

## F4. Fix ThreeBackground Variable Names (Readability)

**Current — unreadable single-letter variable names:**
```tsx
const C = { cy: 0x00f0ff, gn: 0x00ff9d, bl: 0x0050c8 };
const iA = new THREE.Mesh(...);
const rr = new THREE.WebGLRenderer(...);
const sc = new THREE.Scene();
```

**Fix — descriptive names:**
```tsx
const COLORS = { cyan: 0x00f0ff, green: 0x00ff9d, blue: 0x0050c8 };
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 800);
const outerIcosahedron = new THREE.Mesh(icosaGeo, outerMat);
```

---

## F5. Add Loading States and Error Boundaries

**Current:** No global error boundary. An unhandled React render error crashes the entire app.

```tsx
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <h2>SYSTEM_ERROR</h2>
          <p>{(this.state.error as Error).message}</p>
          <button onClick={() => this.setState({ error: null })}>RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap each view:
<ErrorBoundary><CreatePresentation /></ErrorBoundary>
```

---

## F6. Add Code Splitting / Lazy Loading

**Current:** Single bundle includes Three.js + all 9 views + admin panel. Every user downloads the admin panel code even if they're a regular user.

```tsx
// src/App.tsx — lazy load per route
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./views/Dashboard'));
const CreatePresentation = lazy(() => import('./views/CreatePresentation'));
const AdminPanel = lazy(() => import('./views/admin/AdminPanel'));

// In router:
<Suspense fallback={<div className="loading-spinner">LOADING...</div>}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/create" element={<CreatePresentation />} />
    <Route path="/admin" element={<AdminPanel />} />
  </Routes>
</Suspense>
```

This alone can reduce initial bundle size by 40–60%.

---

## F7. Move to Zustand for Global State

**Current:** `AuthContext` covers auth. Everything else (generated slides, history, admin data) lives inside App.tsx's local state — lost on navigation.

```bash
npm install zustand
```

```ts
// src/store/presentation.ts
import { create } from 'zustand';
import type { GenerateResponse } from '../types';

interface PresentationStore {
  current: GenerateResponse | null;
  history: SavedPresentation[];
  setCurrent: (p: GenerateResponse) => void;
  setHistory: (h: SavedPresentation[]) => void;
}

export const usePresentationStore = create<PresentationStore>((set) => ({
  current: null,
  history: [],
  setCurrent: (current) => set({ current }),
  setHistory: (history) => set({ history }),
}));
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 4 — ML / AI ENGINEERING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## M1. Add LLM Response Validation and Retry Logic

**Current — single parse attempt, no retry on malformed JSON:**
```python
def _parse_and_validate(raw: str) -> list:
    try:
        data = json.loads(raw.strip())
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON: {e}")
        raise  # request fails with 500
```

**Fix — add exponential backoff retry with temperature bump:**
```python
# llm_client.py
import asyncio

async def _call_groq_with_retry(title, topics, num_slides, context, tone, include_notes, max_retries=2):
    """Retry on JSON parse failure with slightly higher temperature."""
    base_temp = TONE_CONFIG.get(tone, TONE_CONFIG["professional"])["temperature"]
    
    for attempt in range(max_retries + 1):
        try:
            temp_bump = attempt * 0.05  # slight creativity bump on retry
            result = await asyncio.to_thread(
                _call_groq_raw,
                title, topics, num_slides, context, tone,
                temperature_override=min(base_temp + temp_bump, 0.95),
                include_notes=include_notes
            )
            return result
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == max_retries:
                logger.error("LLM JSON parse failed after %d attempts: %s", max_retries + 1, e)
                raise
            wait = 2 ** attempt  # 1s, 2s
            logger.warning("LLM JSON parse failed (attempt %d/%d), retrying in %ss", attempt + 1, max_retries + 1, wait)
            await asyncio.sleep(wait)
```

---

## M2. Improve Technical Topic Detection

**Current — simple keyword substring match, many false positives/negatives:**
```python
TECHNICAL_KEYWORDS = ["python", "react", "javascript", ...]

def is_technical_topic(title: str, topics: list) -> bool:
    text = title.lower()
    return any(kw in text for kw in TECHNICAL_KEYWORDS)
```

**Problems:**
- "The history of computer art" → wrongly triggers NVIDIA routing ("computer" is not in the list, but "art" topics about coding do trigger it)
- "React to Change" (a business topic) → triggers technical routing
- Entire topic list checked as raw string → "backend sales strategy" matches "backend"

**Fix — word-boundary matching + confidence threshold:**
```python
import re

def is_technical_topic(title: str, topics: list, threshold: int = 2) -> bool:
    """
    Returns True if at least `threshold` distinct technical keywords match
    as whole words (not substrings). Reduces false positives.
    """
    text = (title + " " + " ".join(topics)).lower()
    matched = set()
    for kw in TECHNICAL_KEYWORDS:
        pattern = r'\b' + re.escape(kw) + r'\b'
        if re.search(pattern, text):
            matched.add(kw)
    return len(matched) >= threshold
```

---

## M3. Add LLM Output Quality Scoring

**Current — any response that parses as JSON is accepted, even low-quality output:**
```python
# A slide with content = ["text", "text", "text", "text", "text"] passes validation
```

**Fix — add a quality filter:**
```python
def _score_slide_quality(slide: dict) -> float:
    """Returns 0.0 to 1.0. Below 0.5 = reject and retry."""
    score = 1.0
    content = slide.get("content", [])
    
    # Penalize short bullets (< 10 words)
    short_bullets = sum(1 for b in content if len(b.split()) < 10)
    score -= short_bullets * 0.1
    
    # Penalize placeholder text
    placeholders = ["placeholder", "insert", "add content", "tbd", "lorem ipsum", "["]
    for b in content:
        if any(p in b.lower() for p in placeholders):
            score -= 0.3
            break
    
    # Penalize missing content
    if len(content) < 3:
        score -= 0.5
    
    return max(0.0, score)

def _parse_and_validate(raw: str) -> list:
    ...
    validated = []
    low_quality = []
    for item in data:
        slide = normalize(item)
        q = _score_slide_quality(slide)
        if q >= 0.5:
            validated.append(slide)
        else:
            low_quality.append(slide["title"])
    
    if low_quality:
        logger.warning("Low-quality slides filtered: %s", low_quality)
    return validated
```

---

## M4. Add LLM Cost Tracking and Budget Guardrails

**Current:** No tracking of token usage, no alerts when costs spike.

**Fix — track token usage in generation logs:**
```python
# llm_client.py — capture token counts from Groq response
completion = client.chat.completions.create(...)

usage = completion.usage
slides = _parse_and_validate(completion.choices[0].message.content.strip())

return slides, {
    "prompt_tokens": usage.prompt_tokens,
    "completion_tokens": usage.completion_tokens,
    "total_tokens": usage.total_tokens,
    "estimated_cost_usd": usage.total_tokens * 0.00000059  # Groq llama3.3 pricing
}

# main.py — store in generation_logs
await generation_logs_collection.insert_one({
    ...existing fields...,
    "token_usage": token_stats,
    "model": model_used,
    "provider": provider,
})

# Admin endpoint: GET /admin/costs → aggregate token_usage by day
```

---

## M5. Add Prompt Versioning

**Current:** The system prompt in `_build_prompt` is a string literal with no version tracking. When you improve it, you can't tell which generation used which prompt version — making A/B testing impossible.

**Fix:**
```python
# llm_client.py
PROMPT_VERSION = "v2.1"

def _build_prompt(title, topics, ...):
    # Add version tag to the end of system prompt
    system_prompt = f"""...(existing prompt)...

# PROMPT_VERSION: {PROMPT_VERSION}"""
    return system_prompt, user_prompt

# Log the prompt version with each generation
await generation_logs_collection.insert_one({
    ...
    "prompt_version": PROMPT_VERSION,
})
```

When you ship `v2.2`, you can compare quality metrics between versions.

---

## M6. Add RAG Support for Document-Grounded Presentations

**Current:** `/upload-context` extracts text and caps it at 10,000 chars passed as raw context to the LLM.

**Problem:** A 50-page document → 10K chars → only the first ~8 pages matter. The rest is cut off.

**Better approach — chunked context retrieval (simple RAG without a vector DB):**
```python
# services/context_service.py
def extract_relevant_chunks(full_text: str, topics: list, max_chars: int = 4000, top_k: int = 5) -> str:
    """
    Split document into 500-char chunks. Score each chunk by topic keyword overlap.
    Return top_k most relevant chunks, up to max_chars total.
    """
    chunk_size = 500
    chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
    
    topic_words = set(" ".join(topics).lower().split())
    
    def score(chunk: str) -> int:
        words = set(chunk.lower().split())
        return len(words & topic_words)
    
    ranked = sorted(chunks, key=score, reverse=True)[:top_k]
    context = "\n---\n".join(ranked)
    return context[:max_chars]
```

This ensures the most topic-relevant parts of the document are always included, regardless of where they appear in the file.

---

## M7. Add Generation Monitoring Dashboard Data

**Current:** `generation_logs_collection` stores logs but `/admin/stats` only returns counts.

**Expose richer metrics for the admin panel:**
```python
@router.get("/admin/analytics")
async def admin_analytics(admin_user=Depends(require_admin)):
    """Returns 7-day generation trends, provider split, avg generation time, top themes."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": seven_days_ago}, "action": "generate"}},
        {"$group": {
            "_id": {
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "status": "$status"
            },
            "count": {"$sum": 1},
            "avg_time_ms": {"$avg": "$execution_time_ms"},
        }},
        {"$sort": {"_id.day": 1}}
    ]
    
    results = await generation_logs_collection.aggregate(pipeline).to_list(length=100)
    return {"analytics": results}
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EXECUTION ROADMAP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Week 1 — Critical Fixes (2–4 hours total)

| Task | File | Effort |
|------|------|--------|
| Fix cache key (add num_slides + context) | `main.py` line 400 | 5 min |
| Add JWT startup guard | `main.py` | 10 min |
| Remove `role` from UserRegister | `main.py` | 5 min |
| Add LLM timeout with `asyncio.wait_for` | `llm_client.py` | 15 min |
| Fix bare `except` → specific exceptions | `main.py` (×8) | 20 min |
| Fix tone/TONE_CONFIG mismatch | `llm_client.py` | 30 min |
| Add `num_slides` to THEMES shared module | new `shared/themes.py` | 20 min |

## Week 2 — Architecture (4–8 hours)

| Task | Effort |
|------|--------|
| Create `core/config.py` with pydantic-settings | 1h |
| Split `main.py` into `routers/` (auth, generate, admin, export) | 3h |
| Replace `_ppt_store` with MongoDB GridFS | 2h |
| Add request ID middleware | 30 min |

## Week 3 — Frontend (4–6 hours)

| Task | Effort |
|------|--------|
| Install React Router, split 9 views into files | 3h |
| Create `src/api/client.ts` with typed methods | 1h |
| Extract `usePresentation` and `useAdmin` hooks | 1h |
| Add `ErrorBoundary` component | 30 min |
| Add lazy loading for admin routes | 30 min |

## Week 4 — ML/AI Quality (2–3 hours)

| Task | Effort |
|------|--------|
| Add retry logic with exponential backoff | 1h |
| Fix technical topic detection (word-boundary) | 30 min |
| Add slide quality scorer | 1h |
| Add prompt versioning | 15 min |
| Add token usage tracking to generation logs | 30 min |

---

*Generated by Senior Engineering Review — Skynet PPT Generator v2.4.0*
*Covers: Architecture · Backend · Frontend · ML/AI Engineering*
