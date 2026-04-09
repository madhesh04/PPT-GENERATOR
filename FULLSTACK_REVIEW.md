# Skynet PPT Generator — Senior Fullstack Engineering Review
> Reviewed by: Senior Fullstack Engineer | Date: April 9, 2026

---

## 1. SUMMARY

Skynet is a fullstack AI presentation generator built with **FastAPI (Python) + React/TypeScript (Vite)**. The product is functionally impressive — multi-LLM routing, image sourcing fallback, content caching via MongoDB, multi-role auth, admin panel — all shipped in a lean two-person-sized codebase.

The core risk is **architectural debt accumulating in two God files**: `backend/main.py` (~900 LOC, handles auth, routes, DB, file extraction, models, business logic in one place) and `frontend/src/App.tsx` (26K+ tokens — all views, all state, all effects, Three.js canvas, and custom cursor in one component). Both will collapse under feature growth or team scaling.

**Security is solid in places (bcrypt, rate limiting, JWT) but has several critical holes** — most notably the JWT fallback secret, XSS-vulnerable token storage, and a role self-assignment surface on the registration endpoint.

**Performance is genuinely at risk at scale** due to an in-memory PPT store that breaks under multi-worker deployment.

---

## 2. ARCHITECTURE REVIEW

### Pattern
Monolithic backend with a single-file router, no service layer, no repository pattern. The frontend is a single-component SPA with no state management library and no route-level code splitting.

### What's Good
- **Async-first backend**: Motor (async MongoDB driver), `asyncio.gather` for parallel image fetching, `asyncio.to_thread` for sync LLM SDK calls. This is done correctly.
- **LLM provider routing**: Auto-detection of technical topics to route to NVIDIA NIM with Groq as fallback is a smart, practical design.
- **Image source fallback chain**: Freepik → Unsplash → Pollinations. Resilient and well-structured.
- **MongoDB content-hash cache**: Avoids redundant LLM calls for identical requests. Good for cost control.
- **Rate limiting**: `slowapi` integrated at the route level. Rate limits set (10/min on `/generate`, 20/min globally).
- **lifespan hooks**: Indexes, settings backfill, and cleanup task bootstrapped cleanly via FastAPI's `asynccontextmanager`.

### What's Risky
- **God module in `main.py`**: Auth logic, Pydantic models, MongoDB collections, route handlers, file extraction helpers — all in one file. Adding a new feature means touching the same 900-line file, causing merge conflicts and high cognitive load.
- **God component in `App.tsx`**: All views (`dashboard`, `create`, `preview`, `history`, `settings`, `admin_panel`, `user_mgmt`, `pending`, `global_gen`) are rendered via a single `view` string state flag inside one giant component tree with dozens of `useState` calls. This is unmaintainable beyond 3 developers.
- **No deployment config for the backend**: No `Dockerfile`, no `docker-compose.yml`. The `Procfile` is Heroku-style and implies one process — but the in-memory store (see Performance) makes multi-worker deployment dangerous.
- **`dist/` and `scratch/` committed to Git**: Build artifacts and diagnostic scripts (`db_diag.py`, `bcrypt_diag.py`) belong in `.gitignore`, not source control.

---

## 3. CODE QUALITY REVIEW

### Critical Issues

**A. Bare `except` clauses (Anti-pattern)**
```python
# main.py — multiple occurrences
try:
    obj_id = ObjectId(user_id)
except:
    raise HTTPException(status_code=400, detail="Invalid user ID")
```
This swallows ALL exceptions — including `KeyboardInterrupt`, `SystemExit`, and your own bugs. Always be specific:
```python
except (InvalidId, Exception) as e:
    raise HTTPException(status_code=400, detail="Invalid user ID")
```

**B. THEMES dict duplicated across modules**
`generator.py` and `pdf_generator.py` both define their own `THEMES` dict with overlapping but slightly different structures. This is a DRY violation — they'll drift apart. Extract to a shared `themes.py`.

**C. Tone validator mismatch**
`PresentationRequest.validate_tone` accepts `{"professional", "executive", "technical", "academic", "sales", "simple"}` but `llm_client.py`'s `TONE_CONFIG` only defines `professional`, `creative`, `technical`, `educational`. Any "executive", "sales", or "simple" tone silently falls through to "professional" without any indication to the caller.

**D. `import time` inside a function body**
```python
# main.py, line 597
async def export_ppt(...):
    ...
    import time  # ← inside the function
    normalized_str = f"edited-{body.title.lower().strip()}-{time.time()}"
```
`time` is already imported at the top of the file. This is dead weight and confusing.

**E. Hardcoded `MASTER_EMAIL` in source code**
```python
MASTER_EMAIL = "admin@skynet.ai"
```
This is a governance decision baked into source. It should be an environment variable (`MASTER_EMAIL=admin@skynet.ai`) so it can be rotated without a code change.

**F. Stub data returned from admin endpoint**
```python
p["tone"] = "Professional"  # Stub tone since not stored explicitly
p["status"] = "COMPLETE"
```
This is returning fabricated data to a client. Either store `tone` at generation time or omit the field. Lying to your own admin panel is a maintenance trap.

**G. Cache key excludes `num_slides` and `context`**
```python
normalized_str = f"{body.title.lower()}-{'|'.join(sorted(...topics))}-{body.tone}-{body.theme}"
```
A user generating 5 slides and then 10 slides on the same topic will get a cache hit and receive the wrong slide count. `num_slides` and a hash of `context` must be part of the cache key.

**H. `bcrypt` double import**
`requirements.txt` has both `bcrypt` (direct) and `passlib[bcrypt]` (wrapper). `main.py` uses raw `bcrypt` calls. Pick one; `passlib` is the idiomatic choice for FastAPI and handles algorithm versioning.

---

## 4. PERFORMANCE ANALYSIS

### 🔴 High Risk: In-Memory PPT Store Is Not Multi-Worker Safe
```python
_ppt_store: dict[str, tuple[io.BytesIO, str, float]] = {}
```
This dict lives in the process's memory. When deployed with `gunicorn --workers 4` (standard production), each worker has its own isolated `_ppt_store`. A `/generate` request hitting Worker 1 stores the file there; a subsequent `/download/{token}` hitting Worker 3 gets a 404. This is a **silent data loss bug in production under load**.

**Fix**: Store PPTX files in a shared store — Redis (binary), S3/R2 (object storage), or MongoDB GridFS. Given you already have MongoDB, GridFS is zero-infrastructure-cost.

### 🔴 High Risk: Synchronous LLM Call Blocks Event Loop Without Timeout
```python
slides = await asyncio.to_thread(_call_groq, ...)
```
`asyncio.to_thread` correctly offloads the blocking SDK call, but there's no timeout. If Groq hangs (e.g., during an outage), the request will hang indefinitely, consuming a thread and a connection slot.

**Fix**:
```python
slides = await asyncio.wait_for(
    asyncio.to_thread(_call_groq, ...),
    timeout=45.0
)
```

### 🟡 Medium Risk: No Pagination on Admin Queries
```python
await cursor.to_list(length=500)  # admin/generations
await cursor.to_list(length=500)  # admin/users
```
At 500 presentations, this is fine. At 50,000, this OOMs your server and returns a multi-megabyte JSON to the browser. Add cursor-based or offset pagination (`skip`/`limit` query params) now, before data grows.

### 🟡 Medium Risk: 60-Second Image Timeout Blocks Generation
```python
async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
    r = await client.get(url, ...)  # Pollinations
```
Pollinations is a free AI image service. A 60-second timeout means your `/generate` endpoint can take up to 3 minutes if all three image sources are slow (3 slides × 60s). Reduce to 20–25 seconds and add a global generation timeout.

### 🟡 Medium Risk: Base64 Images in API Response
Images are fetched, base64-encoded, and sent in the JSON response body. A 1344×768 image at ~200KB becomes ~267KB of base64 text. Five slides = ~1.3MB JSON payload. This is slow to transfer, slow to parse, and stresses the browser's DOM.

**Fix**: Return signed URLs or upload images to S3/Cloudinary and return the URL. The frontend renders `<img src="url">` which is streaming-friendly.

---

## 5. SECURITY ANALYSIS

### 🔴 CRITICAL: JWT Secret Has an Insecure Default
```python
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
```
If `JWT_SECRET` is not set in the environment (easy to miss in a fresh deployment), the app silently uses a well-known, predictable secret. Anyone who reads your source code on GitHub can forge admin tokens.

**Fix**: Fail fast if the secret is missing:
```python
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set. Refusing to start.")
```

### 🔴 CRITICAL: JWT Stored in `localStorage` (XSS Vulnerability)
```javascript
// AuthContext.tsx
localStorage.setItem('auth_token', newToken);
```
`localStorage` is accessible to any JavaScript running on the page — including injected scripts from XSS attacks. A single reflected XSS vector lets an attacker steal every user's auth token.

**Fix**: Store JWTs in `httpOnly`, `Secure`, `SameSite=Strict` cookies. The backend sets the cookie; the frontend never touches it. This requires adding cookie-based auth to your FastAPI middleware.

### 🔴 HIGH: No Token Revocation
```python
# get_current_user — only decodes, never checks DB
payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
return payload
```
Deleted users, suspended users, and password-changed users can keep using their old tokens for up to 24 hours. There's a `status` field in the DB but it's never checked on authenticated requests.

**Fix**: For sensitive operations (admin routes), add a DB user lookup and check `status`. For regular routes, use short-lived tokens (15 min) + refresh tokens stored in `httpOnly` cookies.

### 🟡 HIGH: Role Self-Assignment in Registration
```python
class UserRegister(BaseModel):
    role: Optional[str] = "user"  # ← user-supplied
```
A user can POST `{"role": "admin"}` to `/auth/register`. The code filters this to "pending", which is correct, but the surface area is unnecessarily wide. Remove `role` from the public registration model entirely. Roles should only be assignable by admins.

### 🟡 MEDIUM: `vercel.json` CSP Allows `unsafe-inline` and `unsafe-eval`
```json
"script-src 'self' 'unsafe-inline' 'unsafe-eval' ..."
```
`unsafe-eval` completely defeats Content-Security-Policy's XSS protection. It's likely needed for Three.js's shader compilation. The fix is to use a nonce-based CSP or move Three.js to a Web Worker.

### 🟡 MEDIUM: Admin Password Reset Leaks Verification State
```python
return {
    "verified": verify_match,  # ← tells caller if hash matched
    "modified": result.modified_count,
    ...
}
```
Returning whether the hash verification passed gives an attacker oracle information about the hashing process. Return only `{"status": "success"}`.

### 🟢 GOOD: bcrypt for password hashing, Pydantic input validation, rate limiting, MongoDB unique index on email.

---

## 6. IMPROVEMENT RECOMMENDATIONS

### Architecture Refactoring

**Backend — Split `main.py` into modules:**
```
backend/
  main.py              ← FastAPI app init, lifespan, middleware only
  routers/
    auth.py            ← /auth/register, /auth/login
    generate.py        ← /generate, /regenerate-slide, /regenerate-image
    export.py          ← /export-pptx, /export-pdf
    presentations.py   ← /presentations/me
    admin.py           ← /admin/* routes
    upload.py          ← /upload-context
  services/
    llm_service.py     ← wraps llm_client.generate_slide_content
    image_service.py   ← wraps image_client.fetch_slide_image
    ppt_service.py     ← wraps generator.create_presentation
  models/
    requests.py        ← Pydantic request models
    responses.py       ← Pydantic response models
  db/
    client.py          ← MongoDB client, collections
    repositories.py    ← data access functions
  core/
    auth.py            ← JWT, password hashing, dependencies
    config.py          ← Settings via pydantic-settings
    themes.py          ← Shared THEMES dict (remove duplication)
```

**Frontend — Split `App.tsx` into view components:**
```
src/
  App.tsx              ← routing shell only
  views/
    Dashboard.tsx
    CreatePresentation.tsx
    SlidePreview.tsx
    History.tsx
    Settings.tsx
    admin/
      AdminPanel.tsx
      UserManagement.tsx
      PendingApprovals.tsx
      GlobalGenerations.tsx
  components/
    ThreeBackground.tsx  ← already extracted
    Cursor.tsx
    SlideCard.tsx
    Toast.tsx
  hooks/
    usePresentation.ts   ← generation state & logic
    useAdmin.ts          ← admin fetch logic
  api/
    client.ts            ← all fetch calls, token injection
  store/
    auth.ts              ← move AuthContext here or use Zustand
```

### Quick Wins (Low effort, high value)

1. **Add `num_slides` + `context` hash to cache key** — prevents wrong slide count returns.
2. **Add `asyncio.wait_for` timeout to LLM calls** — prevents hanging requests.
3. **Move THEMES to a shared module** — eliminate the DRY violation.
4. **Add startup guard for `JWT_SECRET`** — fail loudly, not silently.
5. **Remove `role` from `UserRegister`** — shrink the attack surface.
6. **Add `.gitignore` entries for `dist/`, `scratch/`** — clean up repo.
7. **Pin dependency versions in `requirements.txt`** — `fastapi==0.115.x`, not bare `fastapi`. Unpinned deps break silently.

---

## 7. PRIORITY ACTION PLAN

| # | Issue | Priority | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | **In-memory PPT store → Redis/GridFS** | 🔴 HIGH | Medium | Silent 404s under multi-worker deploy |
| 2 | **JWT default secret + startup guard** | 🔴 HIGH | Low | Forged admin tokens in production |
| 3 | **JWT in `localStorage` → `httpOnly` cookie** | 🔴 HIGH | Medium | Token theft via XSS |
| 4 | **Fix cache key to include `num_slides` + `context`** | 🔴 HIGH | Low | Wrong slide count served from cache |
| 5 | **Add `asyncio.wait_for` LLM timeout** | 🟡 MEDIUM | Low | Hung requests under provider outage |
| 6 | **Split `main.py` into routers + services** | 🟡 MEDIUM | High | Maintainability — growing team will conflict |
| 7 | **Split `App.tsx` into view components + hooks** | 🟡 MEDIUM | High | Maintainability — any new view breaks the file |
| 8 | **Remove `role` from public registration model** | 🟡 MEDIUM | Low | Security surface reduction |
| 9 | **Add pagination to admin list endpoints** | 🟡 MEDIUM | Low | OOM at scale |
| 10 | **Pin all `requirements.txt` versions** | 🟢 LOW | Low | Reproducible builds, no surprise breakage |

---

## 8. WHAT IS DONE WELL

- **Async-all-the-way backend** — no `asyncio.run()` anti-patterns, correct use of `to_thread` for blocking SDK calls.
- **LLM + image fallback chains** — the product stays functional even when one provider is down.
- **Content-hash caching** — smart cost-control for a paid-API dependent product.
- **Pydantic validation** — request models are well-validated with field-level validators.
- **Role-based access control** — `require_admin` / `require_master` dependency injection is clean and correct.
- **MongoDB index creation on startup** — correct practice for schema-less DBs.
- **Rate limiting** — in place and actually enforced per-route.
- **Separation of LLM concern** — `llm_client.py` is cleanly isolated from the router.

---

*Generated by Senior Fullstack Engineering Review — Skynet PPT Generator v2.4.0*
