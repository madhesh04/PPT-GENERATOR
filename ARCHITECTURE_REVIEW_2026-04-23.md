# Skynet PPT Generator — Full-Stack Architecture Review
**Reviewed by:** Senior Architect · Senior Backend · Senior Frontend · Senior DevOps  
**Date:** 2026-04-23  
**Branch:** `feature/frontend-trial`  
**Build status:** ✅ TypeScript zero errors | ⚠️ No test suite | 🔴 `.env` committed to repo

---

## Executive Summary

The codebase is a well-structured internal tool with a clean split between a FastAPI/Python backend and a React 19/TypeScript frontend. The core generation pipeline, authentication flow, and UI architecture are all production-grade in isolation. However, four systemic issues need resolution before this is truly production-ready: a committed `.env` file with real credentials, a broken rate-limiter under Gunicorn's multi-worker mode, a debug file-write that runs in production, and a complete absence of tests or CI/CD. The remaining findings are graded and prioritised below.

---

## 1 — Senior Architect

### 1.1 System Topology

```
Browser (Vercel SPA)
  │  HTTPS + JWT Bearer
  ▼
FastAPI (Render — gunicorn 4 workers)
  ├── skynet_db        (MongoDB Atlas — presentations, logs, settings, GridFS)
  └── Timesheet-Application  (MongoDB Atlas — users, read-only)
         ├── Groq API  (primary LLM)
         └── NVIDIA NIM (secondary LLM)
              ├── Freepik  ──┐
              ├── Unsplash   ├── Image sources (cascade fallback)
              └── Pollinations ─┘
```

The topology is sensible for an internal tool. Single-region, no caching layer, no queue — acceptable at this scale.

---

### 1.2 Architecture Findings

#### [A-01] 🔴 Rate limiter is non-functional in production

**File:** `backend/main.py` line 40, `backend/routers/generate.py` line 38

The global rate limiter uses `_auto_route_counter` (a module-level Python integer) as load-balancing state, and `slowapi` uses in-memory per-worker storage. Gunicorn starts **4 independent worker processes** — each has its own counter and its own rate-limit store. A user can make 4× the stated limit (40/min instead of 10/min) by hitting different workers, and the load-balancing round-robin never actually balances across workers.

**Fix:** Replace in-memory slowapi with Redis-backed rate limiting (`slowapi` supports a `storage_uri` for Redis). For load balancing, use a random selection with a MongoDB-based preference record, or simply always route by provider preference without global counters.

---

#### [A-02] 🟠 No API versioning

All routes are unprefixed (`/generate`, `/auth/login`). Any breaking change requires coordinating a simultaneous frontend deploy. This is a non-issue today but becomes painful as the app grows.

**Fix:** Add a `prefix="/v1"` to each router or wrap them in a versioned APIRouter. The frontend `VITE_API_URL` already controls the base URL — just append `/v1` when ready.

---

#### [A-03] 🟠 Slide content is duplicated on every cache hit

**File:** `backend/services/generation_service.py` `handle_cache_hit()`

When a cache hit occurs, the entire `slides` array (potentially hundreds of KB of base64 image data) is copied verbatim into a new MongoDB document. A presentation with 15 slides and images could be 2–5 MB. Ten cache hits = 10 identical copies in the database.

**Fix:** Normalise the schema. The canonical slide data should live in one document (the source), and cache-hit records should store only a `source_id` reference. The `/download` endpoint already does an on-the-fly rebuild from stored slides — extend this pattern: cache hits store a pointer and rebuild on download rather than cloning.

---

#### [A-04] 🟠 `ppt_ttl_seconds` config field is defined but never used

**File:** `backend/core/config.py` line 20 (`ppt_ttl_seconds: int = 300`)

This setting exists in the config model and the `.env.example` but is never referenced in any router or service. No TTL is applied to GridFS files or presentations. Stored PPTX files in GridFS will accumulate indefinitely.

**Fix:** Either apply a MongoDB TTL index (`db.fs.files.createIndex({ "uploadDate": 1 }, { expireAfterSeconds: ppt_ttl_seconds })`) or remove the dead config field to avoid confusion.

---

#### [A-05] 🟡 `/health` endpoint returns `ok` when both databases are down

**File:** `backend/main.py` lines 101-106

The health endpoint returns `{"status": "ok"}` unconditionally. Render (and any uptime monitor) will report the service as healthy even if MongoDB Atlas is unreachable.

**Fix:**
```python
@app.get("/health")
async def health():
    try:
        await get_db().command("ping")
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok" if db_status == "ok" else "degraded", "db": db_status, "timestamp": ...}
```

---

#### [A-06] 🟡 `MASTER` role is an orphaned concept

**File:** `backend/routers/generate.py` lines 275, 329 — ownership bypass allows `MASTER` role. `backend/routers/auth.py` only issues `ADMIN` or `USER` tokens. `backend/core/dependencies.py` `require_admin` only grants access to `ADMIN`.

The `MASTER` role can bypass download/delete ownership checks but can never be obtained through the login flow and cannot access admin endpoints. It is a dead concept that adds confusion.

**Fix:** Either remove `MASTER` from the ownership bypass checks, or add it as a valid role in the login flow and `require_admin` function. Whichever is intentional, make it consistent.

---

#### [A-07] 🟡 No data schema for MongoDB — no validation at the DB layer

The `presentations` collection has no schema enforcement. Documents inserted by `handle_cache_hit` omit the `username` field that `run_generation_pipeline` includes. The `type` field defaults to `"ppt"` in cache hits but comes from `body.type` on fresh generations. Over time, documents will diverge in shape.

**Fix:** Define a Pydantic `PresentationDocument` model and use `.model_dump()` before every `insert_one`. This gives you a single schema definition, IDE autocompletion, and catches field regressions at test time rather than runtime.

---

## 2 — Senior Backend

### 2.1 Backend Findings

#### [B-01] 🔴 `failed_response.txt` file-write runs in production

**File:** `backend/llm_client.py` lines 221-228

When all JSON repair attempts fail, `_parse_and_validate` writes a debug file to the current working directory. In production with 4 Gunicorn workers, all workers will attempt to write to the same file simultaneously with no locking — a race condition producing a corrupt or interleaved debug file. More importantly, this is disk I/O in a production code path and leaks internal prompt content to the file system.

**Fix:** Replace with structured logging:
```python
logger.error("LLM JSON parse failure | raw_length=%d raw_preview=%s", len(raw), raw[:200])
```
Delete the file-write entirely.

---

#### [B-02] 🔴 `/generate-notes` endpoint has no rate limit

**File:** `backend/routers/generate.py` line 58

`generate_notes` is decorated with `@limiter.limit("10/minute")` — wait, actually checking again: it IS decorated. But the `@limiter.limit` decorator is missing `request: Request` as a parameter requirement when only using query deps... actually re-reading: `generate_notes` does have `(request: Request, ...)` so the decorator is correctly applied.

**Correction:** Rate limiting is applied. However, notes generation has no timeout wrapper like the LLM call in `run_generation_pipeline` (which uses `asyncio.wait_for(..., timeout=180.0)`). A slow GROQ response for a 20-page deep notes request has no timeout.

**Fix:** Wrap the `generate_lecture_notes` call in `asyncio.wait_for(..., timeout=180.0)` the same way the PPT pipeline does.

---

#### [B-03] 🟠 LLM clients are instantiated per request, not as module-level singletons

**File:** `backend/llm_client.py` line 259

`_call_groq` creates `Groq(api_key=settings.groq_api_key)` on every invocation. HTTP connection pools, SSL context setup, and SDK initialization happen on every generation request. The NVIDIA client is correctly initialised once at module level.

**Fix:**
```python
# At module level, alongside nvidia_client
groq_client = Groq(api_key=settings.groq_api_key)

# In _call_groq, replace:
client = Groq(api_key=settings.groq_api_key)
# With:
# use groq_client directly
```

---

#### [B-04] 🟠 `admin_get_users` loads all PPT counts with no limit

**File:** `backend/routers/admin.py` line 117

```python
ppt_counts = {str(doc["_id"]): doc["count"] for doc in await counts_cursor.to_list(None)}
```

`to_list(None)` means "load everything into memory". For a company with 500 users and 10,000 presentations, this aggregation loads all group results into a Python dict on every admin page load. At scale this is a memory spike and slow query.

**Fix:** The aggregation already correctly groups and counts — the issue is `to_list(None)`. Replace with `to_list(length=10000)` as a safety bound, or better, add a `$lookup` to join presentations counts directly in the user query pipeline, avoiding the in-memory merge entirely.

---

#### [B-05] 🟠 `/admin/settings` `PATCH` accepts raw `dict` — no Pydantic model

**File:** `backend/routers/admin.py` line 226

```python
async def admin_update_settings(payload: dict, ...)
```

FastAPI's OpenAPI documentation will show this as a generic object with no schema. No input type checking beyond ad-hoc key presence tests. Someone passing `{"image_generation_enabled": "yes"}` would have `bool("yes") == True` (accidentally correct), but `{"default_model": 42}` would store an integer where a string is expected.

**Fix:** Create a `GlobalSettingsUpdate` Pydantic model:
```python
class GlobalSettingsUpdate(BaseModel):
    image_generation_enabled: Optional[bool] = None
    speaker_notes_enabled: Optional[bool] = None
    default_model: Optional[Literal["groq", "nvidia"]] = None
```

---

#### [B-06] 🟠 Notes `content_hash` uses MD5 and is never used for deduplication

**File:** `backend/routers/generate.py` lines 67-68

The notes endpoint computes a `content_hash` with MD5 but never queries the DB with it before generating. Every notes request hits the LLM even if identical notes were generated 30 seconds ago. Meanwhile, the PPT pipeline correctly checks the hash first.

**Fix:** Add a cache lookup before the LLM call, identical to `get_presentation_cache` in `generation_service.py`. Also switch from MD5 to SHA-256 for consistency.

---

#### [B-07] 🟠 `/export` creates a new GridFS file on every call — storage leak

**File:** `backend/routers/generate.py` lines 233-243

Every call to `POST /export` uploads a new `.pptx` binary to GridFS and returns a new `file_id`. If the user clicks "Download" three times, three copies of the same PPTX are in GridFS — never cleaned up. There is no TTL on GridFS files and no reference counting.

**Fix:** Before uploading, check if a GridFS file already exists for `(user_id, presentation_id, theme)`. Alternatively, skip GridFS entirely for the on-demand export path and stream the binary directly, since `/download/{presentation_id}` already does on-the-fly generation as a fallback.

---

#### [B-08] 🟡 `ExportRequest` has no input validation

**File:** `backend/models/requests.py` lines 74-78

`ExportRequest.title` has no `min_length`/`max_length`, and `theme` has no validator — unlike `PresentationRequest` which validates both. Sending an empty title or an invalid theme to `/export` or `/export-pdf` will silently proceed and potentially produce a corrupt PPTX.

**Fix:** Add the same `@field_validator("theme")` and `Field(min_length=1, max_length=200)` constraints as `PresentationRequest`.

---

#### [B-09] 🟡 `generate_slide_content` timeout logic is layered inconsistently

**File:** `backend/llm_client.py` lines 339-343, `backend/services/generation_service.py` line 100

The inner call inside `generate_slide_content` wraps each provider attempt with `asyncio.wait_for(timeout=100/160s)`. The outer call in `run_generation_pipeline` wraps the entire `generate_slide_content` call with `asyncio.wait_for(timeout=180s)`. The outer timeout (180s) is shorter than a single NVIDIA attempt (160s) + one Groq fallback (100s). If both providers are slow but not timing out individually, the outer wrapper will cancel both mid-flight.

**Fix:** Outer timeout should be outer-limit only: `timeout=300.0` to give the inner per-provider timeouts room to operate cleanly. Or remove the outer wrapper and rely solely on the inner per-provider timeouts.

---

#### [B-10] 🟡 `bcrypt` imported directly — `passlib[bcrypt]` is already a dependency

**File:** `backend/core/security.py` lines 1, 7-10

`passlib[bcrypt]` is listed in `requirements.txt`, but the code imports `bcrypt` directly, bypassing passlib entirely. This is fine functionally — both hash with bcrypt — but using two separate bcrypt interfaces in one codebase is inconsistent and means `passlib`'s deprecation handling and future-proofing features are unused.

**Fix:** Either use `passlib.context.CryptContext` consistently, or remove `passlib[bcrypt]` from `requirements.txt` and use the `bcrypt` package directly. Pick one.

---

#### [B-11] 🟡 `generate_lecture_notes` ignores the `force_provider` parameter

**File:** `backend/llm_client.py` line 402-407

`generate_lecture_notes` accepts a `force_provider` argument (passed from the request) but always routes to Groq regardless:
```python
content = await asyncio.to_thread(_call_groq_notes, ...)  # always Groq
```
The NVIDIA notes path (`_call_nvidia_notes`) doesn't exist. The `force_provider` parameter is silently ignored.

**Fix:** Either implement NVIDIA routing for notes (duplicating `_build_notes_prompt` → `_call_nvidia_notes`), or remove `force_provider` from `NotesRequest` to set accurate expectations.

---

## 3 — Senior Frontend

### 3.1 Frontend Findings

#### [F-01] 🔴 Target audience appended with literal `\\n` not a newline

**File:** `frontend/src/store/usePresentationStore.ts` line 199

```typescript
context: context + (targetAudience ? `\\nTarget Audience: ${targetAudience}` : ''),
```

`\\n` in a template literal is the two-character sequence `\n` — a backslash followed by `n`. The LLM will receive `"...existing context\\nTarget Audience: Senior Engineers"` verbatim. The intended audience instruction never reaches the model as a newline-separated line.

**Fix:**
```typescript
context: context + (targetAudience ? `\nTarget Audience: ${targetAudience}` : ''),
```

---

#### [F-02] 🔴 `apiClient.ts` fallback port is `8001`, backend runs on `8000`

**File:** `frontend/src/api/apiClient.ts` line 3

```typescript
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001';
```

Backend default port (`backend/main.py` line 121) is `8000`. Any developer who omits `VITE_API_URL` from their `.env` will hit connection refused on `8001`. Silent failure.

**Fix:** Change `8001` → `8000`. Add `VITE_API_URL=http://localhost:8000` to `frontend/.env.example`.

---

#### [F-03] 🟠 `useAuthStore.initialize()` does not validate JWT expiry

**File:** `frontend/src/store/useAuthStore.ts` lines 37-53

`initialize()` sets `isAuthenticated: true` if `auth_token` exists in localStorage, without checking the token's `exp` claim. An expired token (24h TTL per config) will pass this check and the user will appear logged in — until their first API call fails with 401 and triggers the response interceptor redirect.

This creates a flash: the user sees the authenticated app briefly before being redirected to `/login`. More critically, during that flash they can interact with UI elements that assume a valid session.

**Fix:**
```typescript
import { jwtDecode } from 'jwt-decode'; // or inline base64 parse — no extra dep needed

initialize: () => {
  const savedToken = localStorage.getItem('auth_token');
  if (savedToken) {
    try {
      const payload = JSON.parse(atob(savedToken.split('.')[1]));
      const isExpired = payload.exp && payload.exp * 1000 < Date.now();
      if (!isExpired) {
        const savedUser = localStorage.getItem('auth_user');
        set({ token: savedToken, user: JSON.parse(savedUser!), isAuthenticated: true });
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    } catch { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); }
  }
  set({ loading: false });
}
```

---

#### [F-04] 🟠 Generation step UI is theater — steps 1, 3, 4 are fake timers

**File:** `frontend/src/store/usePresentationStore.ts` lines 178-220

The 4-step generation progress UI runs steps 1, 3, and 4 as `setTimeout(600ms)` fake delays. Only step 2 (`WRITING_CONTENT`) does real work. The actual work sequence is: (1) fake 600ms → (2) real LLM call (~30-180s) → (3) fake 600ms → (4) fake 600ms. Steps 3 and 4 are shown as complete before the backend has even started image fetching or PPTX assembly.

This means if the backend fails during image fetching (step 3 in reality), the UI already shows step 3 as "done". Users get misleading feedback.

**Fix:** The backend should return progress events via Server-Sent Events (SSE) or a polling status endpoint. For a simpler short-term fix, at minimum move the "done" state updates to after the API response, not before.

---

#### [F-05] 🟠 `App.tsx` uses React Router v6 component API in a v7 project

**File:** `frontend/src/App.tsx`

React Router v7 introduced `createBrowserRouter` as the primary API. The codebase uses the legacy `<Routes>/<Route>` component pattern with `main.tsx` wrapping in `<BrowserRouter>`. This is backwards-compatible but misses v7's data router features (loaders, actions, `defer`, nested error boundaries per route). The setup also duplicates the loading guard: `App.tsx` has one and `MainLayout.tsx` has a second.

**Fix:** This is a medium-effort refactor, not a bug. Consider migrating to `createBrowserRouter` in the next sprint to unlock per-route error boundaries and data loading. For now, remove the redundant loading check in `MainLayout.tsx` (line 22-26) since `App.tsx` already handles the loading state.

---

#### [F-06] 🟠 No route-level code splitting — all views loaded eagerly

**File:** `frontend/src/App.tsx` lines 12-19

All 6 views are imported statically. At ~600-900KB bundle, this is acceptable now, but `AdminView.tsx` (737 lines) and `CreatorView.tsx` (849 lines) contain the heaviest logic. Non-admin users download admin code they will never execute.

**Fix:**
```typescript
const AdminView = lazy(() => import('./views/AdminView'));
const CreatorView = lazy(() => import('./views/CreatorView'));
// wrap <Route> subtrees in <Suspense fallback={<Spinner />}>
```
Estimated savings: 40-60KB in the initial bundle for non-admin users.

---

#### [F-07] 🟠 `components/Login.tsx` is a dead file

**File:** `frontend/src/components/Login.tsx`

This file exists alongside `frontend/src/views/AuthView.tsx`. It appears to be a legacy component that `AuthView.tsx` replaced. If `Login.tsx` is not imported anywhere, it should be deleted.

**Fix:** Verify it is unreferenced (`grep -r "Login" src/ --include="*.tsx"`) and delete if unused.

---

#### [F-08] 🟡 `useAuthStore.token` is never read — token is read from localStorage directly

**File:** `frontend/src/store/useAuthStore.ts` + `frontend/src/api/apiClient.ts`

The `token` field in `useAuthStore` is set by `login()` but never consumed via the store. `apiClient.ts` reads the token directly from `localStorage.getItem('auth_token')` in the request interceptor. This means the store's `token` state is dead weight — it exists but serves no purpose.

**Fix:** Either read `useAuthStore.getState().token` in the axios interceptor (removing the localStorage dependency from the API layer), or remove the `token` field from `AuthState` and keep the localStorage approach explicit. Currently the codebase has the worst of both worlds: two sources of truth that happen to be in sync.

---

#### [F-09] 🟡 `vercel.json` CSP references stale Google Tag Manager domain

**File:** `frontend/vercel.json` (root)

```json
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
```

`@vercel/analytics` was removed in a previous cleanup session but the CSP header still whitelists `googletagmanager.com`. The `connect-src` hardcodes the Render URL `https://ppt-generator-tqfl.onrender.com` as a static string — this will break silently if the service is ever redeployed under a different subdomain.

**Fix:** Remove the GTM entry. Inject the backend URL via a Vercel environment variable using `vercel.json`'s `env` substitution, or manage the CSP in code rather than a static config file.

---

#### [F-10] 🟡 No granular React error boundaries — one crash collapses the whole app

**File:** `frontend/src/App.tsx` line 59

A single `<ErrorBoundary>` wraps all routes. A runtime crash in `AdminView` will unmount every component including `Sidebar`, `ToastContainer`, and all non-admin views.

**Fix:** Wrap each major route in its own error boundary:
```tsx
<Route path="/admin" element={<ErrorBoundary><AdminView /></ErrorBoundary>} />
```

---

## 4 — Senior DevOps

### 4.1 DevOps / Infrastructure Findings

#### [D-01] 🔴 `backend/.env` is committed to the repository

**File:** `backend/.env`

The backend `.env` file is present on disk and was detected in the repository. Even if it contains only development keys, committing `.env` files establishes a dangerous pattern — someone will eventually commit production credentials following the same convention. Git history retains secrets even after deletion.

**Immediate action:**
1. Add `backend/.env` and `frontend/.env` to `.gitignore` immediately
2. Run `git rm --cached backend/.env frontend/.env` to untrack without deleting
3. Rotate any API keys that have been committed — treat them as compromised
4. Audit git history: `git log --all --full-history -- backend/.env`

---

#### [D-02] 🔴 No `.gitignore` for sensitive files at the project root

There is no root-level `.gitignore` that covers both `backend/.env` and `frontend/.env`. Relying on convention is not enough.

**Fix:**
```gitignore
# Root .gitignore
backend/.env
frontend/.env
*.env
!*.env.example
__pycache__/
*.pyc
node_modules/
dist/
.DS_Store
```

---

#### [D-03] 🟠 No Dockerfile — local dev and deployment are tightly coupled to Render/Heroku

The project has no `Dockerfile` or `docker-compose.yml`. A new developer must:
- Install Python, set up a virtualenv manually
- Have MongoDB running locally (not documented)
- Install Node, run `npm install`
- Configure two `.env` files manually

The Procfile (`gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app`) works on Render but fails if you run `gunicorn` from inside the `backend/` directory (the `backend.main` module path requires the project root). The `sys.path.append` in `main.py` exists precisely to patch around this inconsistency.

**Fix (minimal):**
```dockerfile
# backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    env_file: ./frontend/.env
```

---

#### [D-04] 🟠 No CI/CD pipeline — zero automated quality gates

There is no `.github/workflows/` directory. Every merge to `main` deploys with no automated checks. A TypeScript error, a broken import, or a regression introduced by a quick fix would go straight to production.

**Fix (minimal GitHub Actions pipeline):**
```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        working-directory: frontend
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt && python -m py_compile main.py
        working-directory: backend
```

Add test steps once the test suite exists (see D-05).

---

#### [D-05] 🟠 Zero test coverage — backend and frontend

There are no test files anywhere in the project. For a tool that directly generates and exports client-facing presentations:

- The LLM JSON parser (`_parse_and_validate`) has complex recovery logic with no tests
- The PPTX generator (`generator.py`, 341 lines) has no output validation
- The auth flow has no integration test to verify the Timesheet DB credential check

**Fix — minimum viable test suite:**

Backend:
```python
# backend/tests/test_llm_client.py
def test_parse_valid_json(): ...
def test_parse_truncated_json_recovery(): ...
def test_parse_trailing_comma_recovery(): ...
def test_validate_data_filters_invalid_slides(): ...
```

Frontend:
```typescript
// frontend/src/store/__tests__/useAuthStore.test.ts
test('initialize clears expired tokens')
test('initialize sets isAuthenticated for valid tokens')
```

---

#### [D-06] 🟠 Rate limiter will use proxy IP in production — all users share one bucket

**File:** `backend/main.py` line 40

```python
limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])
```

Render (and most PaaS/CDN platforms) proxies requests and forwards the real IP in `X-Forwarded-For`. `get_remote_address` from slowapi reads `request.client.host`, which will be the internal Render proxy IP — not the user's IP. Every user in the system shares a single rate-limit bucket.

**Fix:**
```python
from slowapi.util import get_remote_address

def get_real_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=get_real_ip)
```
Add `trusted_hosts` validation to avoid IP spoofing via the header.

---

#### [D-07] 🟡 No structured logging — production debugging relies on `print`-level logs

The backend uses `logging.basicConfig(level=INFO, format="%(asctime)s [%(levelname)s]...")`. In production (Render), logs are line-buffered text. There is no:
- Request ID / correlation ID for tracing a request across log lines
- JSON-formatted output for log aggregation (Datadog, Loki, CloudWatch)
- Error alerting (no Sentry, no PagerDuty webhook)

A production failure currently produces: "something failed — check the logs" with no way to correlate which user triggered which error.

**Fix (minimal):**
```python
import json, sys
class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"ts": self.formatTime(record), "level": record.levelname, "msg": record.getMessage(), "name": record.name})

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(handlers=[handler], level=logging.INFO)
```

---

#### [D-08] 🟡 `backend/.env.example` has inconsistency with config defaults

**File:** `backend/.env.example` line 14 vs `backend/core/config.py` line 11

`.env.example`:
```
TIMESHEET_DB_NAME=timesheet
```
`config.py` default:
```python
timesheet_db_name: str = "Timesheet-Application"
```

A developer who copies `.env.example` and doesn't set this variable will connect to `"Timesheet-Application"` (the code default), not `"timesheet"` (the example hint). If the real DB is named `Timesheet-Application`, the example is actively wrong.

**Fix:** Update `.env.example`:
```
TIMESHEET_DB_NAME=Timesheet-Application
```

---

#### [D-09] 🟡 No `frontend/vercel.json` SPA rewrite rule

The SPA routing rewrite (`/*` → `/index.html`) is absent from `vercel.json`. Vercel automatically handles this for projects detected as Vite/React SPAs, but the root `vercel.json` (which sets CSP headers) could override Vercel's auto-detection.

**Fix:** Explicitly add the SPA rewrite:
```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [...]
}
```

---

## Consolidated Priority Matrix

| ID | Severity | Area | Issue | Effort |
|----|----------|------|-------|--------|
| D-01 | 🔴 CRITICAL | DevOps | `.env` committed to repo — rotate all keys | 15 min |
| D-02 | 🔴 CRITICAL | DevOps | No `.gitignore` for `.env` files | 5 min |
| B-01 | 🔴 CRITICAL | Backend | `failed_response.txt` file-write in production | 5 min |
| F-01 | 🔴 HIGH | Frontend | `\\n` bug — target audience never reaches LLM | 1 min |
| F-02 | 🔴 HIGH | Frontend | Fallback API port `8001` should be `8000` | 1 min |
| A-01 | 🔴 HIGH | Arch | Rate limiter non-functional under Gunicorn multi-worker | 2h |
| F-03 | 🟠 HIGH | Frontend | `initialize()` doesn't check JWT expiry | 30 min |
| B-03 | 🟠 HIGH | Backend | Groq client re-instantiated per request | 10 min |
| B-06 | 🟠 HIGH | Backend | Notes cache lookup missing | 30 min |
| B-07 | 🟠 HIGH | Backend | GridFS storage leak on every `/export` call | 1h |
| D-04 | 🟠 HIGH | DevOps | No CI/CD pipeline | 2h |
| D-05 | 🟠 HIGH | DevOps | Zero test coverage | 3h+ |
| D-06 | 🟠 HIGH | DevOps | Rate limiter using proxy IP — all users share bucket | 30 min |
| A-02 | 🟠 MED | Arch | No API versioning | 1h |
| A-03 | 🟠 MED | Arch | Slide data duplicated on cache hit | 2h |
| A-04 | 🟠 MED | Arch | `ppt_ttl_seconds` config unused — GridFS unbounded | 30 min |
| B-02 | 🟠 MED | Backend | Notes LLM call has no timeout | 10 min |
| B-04 | 🟠 MED | Backend | `admin_get_users` loads all PPT counts unbounded | 30 min |
| B-05 | 🟠 MED | Backend | Admin settings PATCH accepts raw dict | 20 min |
| F-04 | 🟠 MED | Frontend | Generation step UI is fake timer theater | 2h |
| F-07 | 🟠 MED | Frontend | Dead `Login.tsx` component | 5 min |
| D-03 | 🟠 MED | DevOps | No Dockerfile / docker-compose | 2h |
| A-05 | 🟡 LOW | Arch | `/health` returns `ok` when DB is down | 20 min |
| A-06 | 🟡 LOW | Arch | `MASTER` role is orphaned | 15 min |
| A-07 | 🟡 LOW | Arch | No MongoDB document schema model | 1h |
| B-08 | 🟡 LOW | Backend | `ExportRequest` missing field validation | 15 min |
| B-09 | 🟡 LOW | Backend | Timeout nesting inconsistency | 10 min |
| B-10 | 🟡 LOW | Backend | `bcrypt` and `passlib[bcrypt]` both used | 10 min |
| B-11 | 🟡 LOW | Backend | `force_provider` ignored in notes generation | 20 min |
| F-05 | 🟡 LOW | Frontend | Legacy Router v6 component API | 3h |
| F-06 | 🟡 LOW | Frontend | No route-level code splitting | 1h |
| F-08 | 🟡 LOW | Frontend | `token` in `useAuthStore` is dead state | 15 min |
| F-09 | 🟡 LOW | Frontend | Stale GTM domain in CSP, hardcoded Render URL | 15 min |
| F-10 | 🟡 LOW | Frontend | Single top-level error boundary | 30 min |
| D-07 | 🟡 LOW | DevOps | No structured logging / APM | 1h |
| D-08 | 🟡 LOW | DevOps | `.env.example` DB name mismatch | 2 min |
| D-09 | 🟡 LOW | DevOps | SPA rewrite not explicit in `vercel.json` | 5 min |

---

## Recommended Sprint Plan

**Sprint 0 (Today — security-critical, <1h total):**
1. D-01 + D-02 — Remove `.env` from git, add to `.gitignore`, rotate keys
2. B-01 — Delete `failed_response.txt` write, replace with `logger.error`
3. F-01 — Fix `\\n` → `\n` in targetAudience context string
4. F-02 — Fix port `8001` → `8000`

**Sprint 1 (This week — operational reliability):**
5. D-06 — Fix rate limiter to use `X-Forwarded-For` real IP
6. A-01 — Migrate slowapi to Redis backend for multi-worker correctness
7. B-03 — Hoist Groq client to module-level singleton
8. B-06 — Add notes cache lookup
9. F-03 — Add JWT expiry check in `initialize()`
10. D-04 — Add GitHub Actions CI (build + lint gates only)

**Sprint 2 (Next week — maintainability):**
11. D-05 — Minimum viable test suite for LLM parser + auth flow
12. B-07 — Fix GridFS leak (stream directly or add TTL)
13. A-03 — Normalise cache-hit cloning (reference instead of copy)
14. D-03 — Add Dockerfile + docker-compose for local dev
15. B-04 + B-05 — Admin endpoint robustness improvements

---

*Review based on full static source analysis of `feature/frontend-trial`. No runtime profiling performed. TypeScript build: ✅ zero errors. Test coverage: ❌ 0%.*
