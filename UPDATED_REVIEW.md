# Skynet PPT Generator — Updated Codebase Review
> Skills Applied: Senior Fullstack · Senior Backend · Senior Architect
> Previous review: April 9, 2026 | This review: April 10, 2026

---

## DELTA SCORECARD — What Changed

| Area | Before | After | Grade |
|------|--------|-------|-------|
| `main.py` size | 900+ LOC god file | ~110 LOC clean entry point | ✅ Fixed |
| Backend module structure | Flat | `core/` `db/` `routers/` `services/` `shared/` | ✅ Fixed |
| pydantic-settings config | `os.getenv()` scattered | `core/config.py` with startup guard | ✅ Fixed |
| JWT secret fallback | Silent insecure default | Hard startup failure | ✅ Fixed |
| In-memory PPT store | Process-local dict | MongoDB GridFS `StorageService` | ✅ Fixed |
| Cache key bug | Missing `num_slides`+`context` | Both included | ✅ Fixed |
| LLM call timeout | None (hangs forever) | `asyncio.wait_for(45s)` | ✅ Fixed |
| Image fetch timeout | 60s blocking | `asyncio.wait_for(25s)` | ✅ Fixed |
| Admin pagination | `to_list(500)` no pagination | `skip`/`limit` query params | ✅ Fixed |
| Role self-assignment | `role` in UserRegister | Removed | ✅ Fixed |
| Admin request models | Untyped `dict` | `UpdateRoleRequest`, `UpdateStatusRequest`, `UpdatePasswordRequest` | ✅ Fixed |
| THEMES duplication | Two separate dicts | `shared/themes.py` | ✅ Fixed |
| Frontend App.tsx | 26K-token god component | Clean 58-line router | ✅ Fixed |
| View splitting | All views in one file | 7 separate view files | ✅ Fixed |
| State management | Scattered `useState` × 40+ | Zustand: `useAuthStore`, `usePresentationStore`, `useAppStore` | ✅ Fixed |
| API client | Inline fetch calls | Axios `apiClient` + `api/admin.ts` + `api/presentation.ts` | ✅ Fixed |
| React Router | String state flag | `BrowserRouter` + `Routes` in `main.tsx` | ✅ Fixed |
| JWT in localStorage | Still in localStorage | Still in localStorage | ⚠️ Pending |
| Token revocation | No DB check | No DB check | ⚠️ Pending |
| Rate limiting on /generate | Active | **MISSING** in new routers | 🔴 Regression |

**Overall: Massive improvement. The critical structural debt from the first review is resolved. The items below are the next tier of work.**

---

## REMAINING ISSUES — Ranked by Severity

---

### 🔴 CRITICAL: Rate Limiting Removed from `/generate`

**What happened:** In the old `main.py`, the generate endpoint had:
```python
@app.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(...):
```

In the new `routers/generate.py`, the `@limiter.limit` decorator is completely gone. Any authenticated user can now call `/generate` unlimited times per minute — each call costs real money (LLM + image API credits) and takes 10–60 seconds of compute.

**Fix — add the limiter back to the router:**
```python
# routers/generate.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, ...):
    ...
```

Or better, move rate limit config to a central place and import it in each router that needs it.

---

### 🔴 CRITICAL: `/download/{file_id}` Is Unauthenticated

```python
# routers/generate.py
@router.get("/download/{file_id}")
async def download_ppt(file_id: str):  # ← no auth dependency
```

Any person with a valid MongoDB ObjectId (or a brute-forced one) can download any presentation from any user — with zero authentication. ObjectIds are not secret; they're sequential and guessable.

**Fix:**
```python
@router.get("/download/{file_id}")
async def download_ppt(file_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    # Also verify ownership before serving
    stream = await StorageService.get_file_stream(file_id)
    if not stream:
        # On-the-fly fallback — verify ownership
        presentation = await presentations_coll.find_one({
            "_id": ObjectId(file_id),
            "user_id": ObjectId(current_user["user_id"])  # ← ownership check
        })
        if not presentation:
            raise HTTPException(404, "FILE_OR_PRESENTATION_NOT_FOUND")
    ...
```

---

### 🔴 HIGH: Business Logic Leaking Back Into the Router

The cache hit path in `generate.py` still does direct database operations inside the router, bypassing `generation_service.py`:

```python
# routers/generate.py — cache hit path (lines 38–68)
cached, content_hash = await get_presentation_cache(...)

if cached:
    presentations_collection = get_presentations_collection()  # ← direct DB call in router
    logs_collection = get_generation_logs_collection()         # ← direct DB call in router
    new_doc = {...}
    res = await presentations_collection.insert_one(new_doc)   # ← DB write in router
    await logs_collection.insert_one({...})                    # ← DB write in router
    return {...}

return await run_generation_pipeline(...)  # Only the cache miss uses the service
```

The router's job is to receive a request and return a response. DB inserts belong in the service.

**Fix — move the entire cache hit path into `generation_service.py`:**
```python
# services/generation_service.py
async def handle_generate(body, current_user) -> dict:
    """Single entry point — handles both cache hits and misses."""
    start_time = time.time()
    cached, content_hash = await get_presentation_cache(...)
    
    if cached:
        return await _handle_cache_hit(cached, content_hash, current_user, start_time)
    
    return await run_generation_pipeline(body, current_user, start_time, content_hash)

# routers/generate.py — now truly thin:
@router.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, current_user=Depends(get_current_user)):
    return await handle_generate(body, current_user)
```

---

### 🔴 HIGH: Bare `except` Still Present in `generate.py`

```python
# routers/generate.py — line 155
try:
    header, data = slide.image_base64.split(',', 1)
    image_bytes_list.append(base64.b64decode(data))
except:  # ← catches everything, including KeyboardInterrupt
    image_bytes_list.append(None)
```

**Fix:**
```python
except (ValueError, base64.binascii.Error) as e:
    logger.warning("Failed to decode base64 image for slide, skipping: %s", e)
    image_bytes_list.append(None)
```

---

### 🔴 HIGH: Function-Level Imports in Router

```python
# routers/generate.py
@router.post("/export-pdf")
async def export_pdf(...):
    from pdf_generator import create_pdf_presentation  # ← inside function

@router.post("/export")
async def export_ppt(...):
    from generator import create_presentation          # ← inside function
    from services.storage_service import StorageService # ← inside function
```

Python caches imports after the first load, so this won't re-import on every call — but it's misleading, hides dependencies, and breaks IDE analysis (type checkers can't trace these). All imports must be at module top level.

**Fix — move to top of `generate.py`:**
```python
from pdf_generator import create_pdf_presentation
from generator import create_presentation
from services.storage_service import StorageService
from services.file_extractor import extract_text_from_file
```

---

### 🔴 HIGH: Late Import in `main.py`

```python
# main.py — line 100-104
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }

# Fix for datetime in health route  ← this comment is a red flag
from datetime import datetime       # ← imported AFTER it's already used above
```

This only works because Python runs the function body lazily (not at definition time), but it's a maintenance bomb — anyone moving the import will break the route. Move `from datetime import datetime` to the top of `main.py`.

---

### 🟡 MEDIUM: `UpdateRoleRequest` and `UpdateStatusRequest` Are Weakly Typed

```python
# models/requests.py
class UpdateRoleRequest(BaseModel):
    role: str  # Literal["user", "admin"] would be better  ← your own comment

class UpdateStatusRequest(BaseModel):
    status: str  # Literal["active", "suspended", "pending"]

class UpdatePasswordRequest(BaseModel):
    password: str  # no min_length enforcement
```

The comments say "would be better" — fix it now since it's a one-liner each:

```python
from typing import Literal

class UpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]

class UpdateStatusRequest(BaseModel):
    status: Literal["active", "suspended", "pending"]

class UpdatePasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)
```

---

### 🟡 MEDIUM: `db/client.py` Lazy-Init Is Not Startup-Safe

```python
# db/client.py
class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

def get_db():
    if db.client is None:           # ← not thread-safe under concurrent startup
        db.client = AsyncIOMotorClient(settings.mongodb_uri)
        db.db = db.client.get_database("skynet_db")
    return db.db
```

Under asyncio, two coroutines hitting `get_db()` simultaneously at startup could both see `client is None` and create two Motor clients. The `lifespan` hook in `main.py` already initializes indexes — connect the client there too.

**Fix:**
```python
# db/client.py
class Database:
    client: AsyncIOMotorClient = None
    db = None

db_state = Database()

async def connect_db():
    """Called once from lifespan startup."""
    db_state.client = AsyncIOMotorClient(settings.mongodb_uri)
    db_state.db = db_state.client.get_database("skynet_db")

def get_db():
    if db_state.db is None:
        raise RuntimeError("Database not initialized. Call connect_db() in lifespan first.")
    return db_state.db

# main.py lifespan:
@asynccontextmanager
async def lifespan(app):
    await connect_db()
    await create_indexes()
    ...
    yield
    db_state.client.close()
```

---

### 🟡 MEDIUM: No Admin Route Guard on the Frontend

```python
# App.tsx
<Route element={<MainLayout />}>
    ...
    <Route path="/admin" element={<AdminView />} />      # ← no role check
    <Route path="/admin/users" element={<AdminView />} />  # ← no role check
```

`MainLayout` only checks `isAuthenticated`, not role. A regular `USER` who manually types `/admin` in the browser gets the full admin view. The route protection must check the role.

**Fix:**
```tsx
// components/auth/AdminRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export function AdminRoute() {
  const { user } = useAuthStore();
  const role = user?.role?.toUpperCase();
  if (role !== 'ADMIN' && role !== 'MASTER') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

// App.tsx
<Route element={<MainLayout />}>
  <Route path="/" element={<DashboardView />} />
  ...
  <Route element={<AdminRoute />}>
    <Route path="/admin" element={<AdminView />} />
    <Route path="/admin/users" element={<AdminView />} />
    <Route path="/admin/generations" element={<AdminView />} />
  </Route>
</Route>
```

---

### 🟡 MEDIUM: All 3 Admin URL Paths Point to One Component — Fragile Tab Resolution

```tsx
// App.tsx
<Route path="/admin" element={<AdminView />} />
<Route path="/admin/users" element={<AdminView />} />
<Route path="/admin/generations" element={<AdminView />} />

// AdminView.tsx — tab determined from URL string
const activeTab = location.pathname.includes('/users') ? 'users' : 
                  location.pathname.includes('/generations') ? 'generations' : 'overview';
```

This works but it's fragile — a future route like `/admin/user-settings` would conflict with the `/users` check. The correct approach is separate view components per route OR a single `<AdminView />` route with a tab query param (`/admin?tab=users`).

**Simpler fix — use a dedicated component per admin section:**
```tsx
// App.tsx
<Route element={<AdminRoute />}>
  <Route path="/admin" element={<AdminOverview />} />
  <Route path="/admin/users" element={<AdminUsers />} />
  <Route path="/admin/generations" element={<AdminGenerations />} />
</Route>
```

---

### 🟡 MEDIUM: `usePresentationStore` Has `genSteps: any[]` and Redundant Token Passing

```typescript
// usePresentationStore.ts
genSteps: any[],  // ← should be a typed interface

generatePresentation: async (token: string, onSuccess) => {
  // token is passed as a parameter BUT apiClient interceptor already handles auth!
  headers: { 'Authorization': `Bearer ${token}` }  // ← redundant, interceptor does this
```

The Axios interceptor in `apiClient.ts` already attaches the token from localStorage. Passing `token` manually to `generatePresentation` and re-setting the header is redundant and will cause issues when you move to `httpOnly` cookies.

**Fix:**
```typescript
// Define the step type
interface GenStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  desc: string;
}

// Remove token parameter
generatePresentation: async (onSuccess: () => void) => {
  // apiClient handles auth automatically
  const response = await apiClient.post('/generate', params);
  ...
}

// CreatorView.tsx — no longer needs to pass token
await generatePresentation(() => { navigate('/preview'); });
```

---

### 🟡 MEDIUM: `useAppStore` Global Settings Are Fetched on Every Navigation

```tsx
// MainLayout.tsx
useEffect(() => {
  if (isAuthenticated) {
    const sync = async () => {
      const settings = await adminApi.getPublicSettings();  // ← called every mount
      setGlobalSettings({...});
    };
    sync();
  }
}, [isAuthenticated, setGlobalSettings]);
```

`MainLayout` mounts on every page navigation (it wraps all routes). This fires an API call to `/admin/public/settings` on every route change. That's unnecessary — settings don't change per-navigation.

**Fix — fetch once at app startup, not on every mount:**
```tsx
// App.tsx — fetch settings once after auth is confirmed
const { isAuthenticated, loading } = useAuthStore();
const { setGlobalSettings } = useAppStore();

useEffect(() => {
  if (isAuthenticated && !loading) {
    adminApi.getPublicSettings().then(setGlobalSettings).catch(() => {});
  }
}, [isAuthenticated]);  // Only fires when auth state changes, not on every navigation
```

---

### 🟡 MEDIUM: `old_app.tsx.temp` and `old_index.css.temp` in the Repo

```
/frontend/src/old_app.tsx.temp
/frontend/src/old_index.css.temp
```

These are leftover migration artifacts with 26K+ tokens of code sitting in your production repo. They should be deleted immediately.

```bash
rm frontend/src/old_app.tsx.temp
rm frontend/src/old_index.css.temp
git rm frontend/src/old_app.tsx.temp frontend/src/old_index.css.temp
```

Also add to `frontend/.gitignore`:
```
*.temp
*.bak
```

---

### 🟡 MEDIUM: `get_my_presentations` Has No Pagination (100-item Hard Cap)

```python
# routers/generate.py
presentations = await cursor.to_list(length=100)  # ← hard cap, no pagination returned to frontend
```

You paginated the admin endpoints correctly. The user-facing history endpoint needs the same treatment — a power user with 100+ decks silently gets truncated results with no indication that items are missing.

**Fix:**
```python
@router.get("/presentations/me")
async def get_my_presentations(
    current_user=Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    coll = get_presentations_collection()
    total = await coll.count_documents({"user_id": ObjectId(current_user["user_id"])})
    cursor = coll.find(
        {"user_id": ObjectId(current_user["user_id"])},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    presentations = await cursor.to_list(length=limit)
    return {
        "presentations": serialize_mongo_doc(presentations),
        "total": total,
        "skip": skip,
        "limit": limit
    }
```

---

### 🟡 MEDIUM: No `export` Router — Export Endpoints Pollute `generate.py`

`generate.py` currently handles: generation, regeneration, export-pdf, export-pptx, download, presentations listing, upload-context, and delete. This is 7 concerns in one file. The router split is incomplete.

**Target split:**
```
routers/
  auth.py           ← /auth/*
  generate.py       ← /generate, /regenerate-slide, /regenerate-image
  export.py         ← /export, /export-pdf, /download/{id}  ← NEW
  presentations.py  ← /presentations/me, /presentations/{id}, DELETE  ← NEW
  upload.py         ← /upload-context  ← NEW
  admin.py          ← /admin/*
```

---

### 🟢 LOW: `CORS` Still Has `allow_headers=["*"]` With Credentials

```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],   # ← with credentials=True, this is overly permissive
    allow_methods=["*"],
)
```

When `allow_credentials=True`, best practice is to enumerate specific headers:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

---

### 🟢 LOW: `main.py` CORS Still Has an Env Var Re-Read

```python
# main.py
origins = [settings.frontend_url.rstrip("/"), "http://localhost:5173", ...]
env_origins = os.getenv("FRONTEND_URL", "")  # ← reads from env AGAIN, bypassing pydantic-settings
if env_origins:
    origins.extend(...)
```

`settings.frontend_url` already comes from the env via pydantic-settings. Reading `os.getenv("FRONTEND_URL")` again is redundant and creates a split source of truth. Remove the `os.getenv` call and handle comma-separated URLs in `Settings`:

```python
# core/config.py
class Settings(BaseSettings):
    frontend_url: str = "http://localhost:5173"
    
    @property
    def cors_origins(self) -> list[str]:
        return [url.strip().rstrip("/") for url in self.frontend_url.split(",") if url.strip()]

# main.py
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, ...)
```

---

## ARCHITECTURE DIAGRAM — Current State

```
Browser (React/Vite/Vercel)
│
│  BrowserRouter
│  ├── /login          → AuthView
│  └── MainLayout (auth guard via useEffect)
│       ├── /           → DashboardView
│       ├── /create     → CreatorView ──→ usePresentationStore.generatePresentation()
│       ├── /preview    → PreviewView
│       ├── /history    → HistoryView
│       ├── /settings   → SettingsView
│       └── /admin*     → AdminView  [⚠️ no role guard on route level]
│
│  Zustand Stores: useAuthStore, usePresentationStore, useAppStore
│  API Layer: apiClient (axios) → api/admin.ts, api/presentation.ts
│
↓ HTTPS (JWT Bearer in Authorization header)
│
FastAPI (Python, Railway/Render)
│  main.py ← clean: app init, lifespan, middleware, router mounts
│  │
│  routers/
│  │  auth.py           ← /auth/register, /auth/login
│  │  generate.py       ← /generate, /regen-*, /export*, /download, /presentations, /upload
│  │  admin.py          ← /admin/*
│  │
│  core/
│  │  config.py         ← pydantic-settings (JWT guard on startup)
│  │  security.py       ← bcrypt + JWT
│  │  dependencies.py   ← get_current_user, require_admin, require_master
│  │  converters.py     ← serialize_mongo_doc
│  │
│  services/
│  │  generation_service.py  ← LLM pipeline, cache check, timeouts
│  │  storage_service.py     ← GridFS save/retrieve/delete
│  │  file_extractor.py      ← PDF/DOCX text extraction
│  │
│  db/client.py              ← Motor client (lazy init — needs fix)
│  models/requests.py        ← Pydantic models
│  shared/themes.py          ← deduplicated themes
│
MongoDB Atlas
│  collections: users, presentations, generation_logs, settings
│  GridFS bucket: fs.files, fs.chunks (PPTX storage)
│
External APIs
  Groq API (LLM primary)
  NVIDIA NIM (LLM technical routing)
  Unsplash / Freepik / Pollinations (images)
```

---

## PRIORITY ACTION PLAN — Phase 3

These are the remaining items, ordered strictly by impact:

| # | Issue | File | Effort | Priority |
|---|-------|------|--------|----------|
| 1 | **Re-add rate limiting to /generate** | `routers/generate.py` | 5 min | 🔴 CRITICAL |
| 2 | **Add auth to /download/{file_id}** | `routers/generate.py` | 15 min | 🔴 CRITICAL |
| 3 | **Move cache-hit DB logic into generation_service** | `routers/generate.py` + `services/generation_service.py` | 30 min | 🔴 HIGH |
| 4 | **Fix bare `except:` in export route** | `routers/generate.py` line 155 | 5 min | 🔴 HIGH |
| 5 | **Move all imports to module top level** | `routers/generate.py` | 10 min | 🔴 HIGH |
| 6 | **Fix late `datetime` import in main.py** | `main.py` | 2 min | 🔴 HIGH |
| 7 | **Add `AdminRoute` role guard on frontend** | new `components/auth/AdminRoute.tsx` + `App.tsx` | 20 min | 🔴 HIGH |
| 8 | **Use `Literal` types for UpdateRoleRequest, UpdateStatusRequest** | `models/requests.py` | 5 min | 🟡 MEDIUM |
| 9 | **Fix DB lazy-init — connect in lifespan** | `db/client.py` + `main.py` | 20 min | 🟡 MEDIUM |
| 10 | **Remove token param from `generatePresentation`** | `usePresentationStore.ts` + `CreatorView.tsx` | 15 min | 🟡 MEDIUM |
| 11 | **Move settings fetch from MainLayout to App.tsx** | `MainLayout.tsx` + `App.tsx` | 15 min | 🟡 MEDIUM |
| 12 | **Add pagination to /presentations/me** | `routers/generate.py` | 20 min | 🟡 MEDIUM |
| 13 | **Delete old_app.tsx.temp + old_index.css.temp** | `frontend/src/` | 2 min | 🟡 MEDIUM |
| 14 | **Fix admin tab resolution (AdminRoute + sub-components)** | `App.tsx` + `views/admin/` | 45 min | 🟡 MEDIUM |
| 15 | **Refine CORS headers (enumerate instead of wildcard)** | `main.py` | 5 min | 🟢 LOW |
| 16 | **Remove redundant `os.getenv` CORS re-read** | `main.py` + `core/config.py` | 10 min | 🟢 LOW |

---

## STILL PENDING FROM PHASE 1 (Not Yet Addressed)

These were in the original review and remain open:

| Issue | Status | Notes |
|-------|--------|-------|
| JWT in `localStorage` → `httpOnly` cookie | ⚠️ Pending | Requires backend cookie-based auth overhaul |
| Token revocation check for suspended users | ⚠️ Pending | DB lookup on sensitive routes |
| LLM retry logic on JSON parse failure | ⚠️ Pending | Exponential backoff not yet added |
| Technical topic detection word-boundary fix | ⚠️ Pending | False positives still possible |
| Slide quality scorer | ⚠️ Pending | No output validation |
| Token usage tracking (cost monitoring) | ⚠️ Pending | Generation logs don't store token counts |
| Tone/TONE_CONFIG mismatch | ⚠️ Pending | "executive", "sales" etc. silently fall to "professional" |
| Lazy loading for admin routes | ⚠️ Pending | Bundle includes admin code for all users |
| Error boundary in React | ⚠️ Pending | Unhandled errors crash the entire app |

---

## WHAT'S NOW GENUINELY PRODUCTION-QUALITY

The following are solid and require no further work:

- **Backend module structure** — clean separation of concerns, each file has one job
- **pydantic-settings config with startup guard** — no silent failures
- **GridFS storage service** — multi-worker safe, proper streaming
- **Generation service with timeouts** — no hanging requests
- **Cache key correctness** — `num_slides` + `context` hash included
- **Admin pagination** — `skip`/`limit` implemented correctly with `$lookup` join
- **Zustand state management** — correct domain separation across 3 stores
- **Axios apiClient with interceptors** — clean 401 redirect, auth token injection
- **BrowserRouter + React Router** — proper client-side routing
- **View component separation** — 7 independent, focused files
- **`serialize_mongo_doc` converter** — handles nested ObjectIds + datetimes recursively
- **Role hardening** — `role` removed from UserRegister, Pydantic admin models added

---

*Generated by Senior Engineering Review — Skynet PPT Generator v2.4.0 (Updated)*
*Skills: Senior Fullstack · Senior Backend · Senior Architect*
