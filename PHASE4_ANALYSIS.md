# Skynet PPT Generator — Phase 4 Cross-Domain Analysis
> Skills Applied: Senior Architect · Senior Backend · Senior Fullstack · Senior Frontend  
> Date: April 11, 2026 | Review of latest committed codebase

---

## EXECUTIVE SUMMARY

This is the fourth full review pass of the Skynet PPT Generator codebase. The team has made exceptional progress across all three previous review cycles. **Both remaining critical issues from Phase 3 are now confirmed fixed.** The codebase has crossed from "proof of concept with production risks" into "production-capable with known technical debt."

**Overall health: 🟢 Strong** — All critical and high-severity issues are resolved. One medium item and a set of roadmap improvements remain.

---

## ✅ PHASE 3 ITEMS — FINAL CONFIRMATION

### Critical Issue 1: Cache-Hit DB Logic Moved to Service ✅ FIXED

`routers/generate.py` route handler is now exactly 3 lines:
```python
@router.post("/generate")
@limiter.limit("10/minute")
async def generate_ppt(request: Request, body: PresentationRequest, current_user=Depends(get_current_user)):
    start_time = time.time()
    cached, content_hash = await get_presentation_cache(...)
    if cached:
        return await handle_cache_hit(cached, content_hash, current_user, start_time)
    return await run_generation_pipeline(body, current_user, start_time, content_hash)
```

`services/generation_service.py` now owns `handle_cache_hit()` — the DB insert and log insert both live there. The layered architecture is fully consistent: both the cache-hit and cache-miss paths go through the service layer.

### Critical Issue 2: Bare `except:` in admin.py ✅ FIXED

`from bson.errors import InvalidId` is imported at the top of `admin.py`. All 8 former bare `except:` clauses now read `except InvalidId:`. The router no longer silently swallows `KeyboardInterrupt`, `SystemExit`, or programming bugs.

---

## FULL SCORECARD — ALL PHASES

### Phase 1 (Architecture & Core)

| # | Issue | Status |
|---|-------|--------|
| 1 | Monolithic structure → layered architecture (core/db/routers/services/shared) | ✅ Fixed |
| 2 | GridFS replacing in-memory `_ppt_store` | ✅ Fixed |
| 3 | Cache key bug (missing `num_slides`, `context`) | ✅ Fixed |
| 4 | LLM timeout via `asyncio.wait_for` | ✅ Fixed |
| 5 | JWT default secret (pydantic-settings required field + startup guard) | ✅ Fixed |
| 6 | Duplicated themes → `shared/themes.py` | ✅ Fixed |
| 7 | Pagination on `/presentations/me` | ✅ Fixed |

### Phase 2 (Router, Models, Frontend)

| # | Issue | Status |
|---|-------|--------|
| 8 | Rate limiting lost during router split — re-applied | ✅ Fixed |
| 9 | `/download/{file_id}` unauthenticated | ✅ Fixed |
| 10 | Bare `except:` in export/download routes | ✅ Fixed |
| 11 | Function-level imports moved to module top | ✅ Fixed |
| 12 | Late `datetime` import in `main.py` | ✅ Fixed |
| 13 | `Literal` types for `UpdateRoleRequest`, `UpdateStatusRequest` | ✅ Fixed |
| 14 | `UpdatePasswordRequest` min/max length | ✅ Fixed |
| 15 | DB lazy-init race condition → lifespan `connect_db()` | ✅ Fixed |
| 16 | CORS `allow_headers` and `allow_methods` enumerated | ✅ Fixed |
| 17 | Redundant `os.getenv` CORS re-read removed | ✅ Fixed |
| 18 | `contextlib.asynccontextmanager` double import | ✅ Fixed |
| 19 | `AdminRoute` role guard created and applied in `App.tsx` | ✅ Fixed |
| 20 | Settings fetch moved from `MainLayout` to `App.tsx` (fires once per login) | ✅ Fixed |
| 21 | `token` param removed from `generatePresentation` (interceptor handles it) | ✅ Fixed |
| 22 | `genSteps` typed as `GenStep[]` not `any[]` | ✅ Fixed |
| 23 | `*.temp` / `*.bak` files purged | ✅ Fixed |

### Phase 3 (Final Cleanup)

| # | Issue | Status |
|---|-------|--------|
| 24 | Cache-hit DB logic moved to `generation_service.handle_cache_hit()` | ✅ Fixed |
| 25 | All 8 bare `except:` in `admin.py` → `except InvalidId:` | ✅ Fixed |
| 26 | Admin tab resolution via `pathname.includes()` | 🟡 Still Open |

**Score: 25/26 issues resolved across all three phases. 96%.**

---

## 🟡 ONE REMAINING OPEN ITEM

### Admin Tab Resolution — `AdminView.tsx`

`AdminView.tsx` still resolves its active tab by substring-matching the URL path:

```tsx
const activeTab = location.pathname.includes('/users') ? 'users' : 
                  location.pathname.includes('/generations') ? 'generations' :
                  location.pathname.includes('/pending') ? 'pending' : 'overview';
```

**Risk level: Low** — `AdminRoute` is now in place, so only admin/master users can reach these routes. A future route like `/admin/user-settings` would silently match the `users` tab, but there is no functional breakage today.

**Fix — 15 minutes:**

In `AdminView.tsx`, replace the `pathname.includes` chain with a query param:

```tsx
// Replace:
const activeTab = location.pathname.includes('/users') ? 'users' : ...

// With:
const queryParams = new URLSearchParams(location.search);
const activeTab = queryParams.get('tab') ?? 'overview';
```

Update all tab navigation links to use `?tab=`:
```tsx
// Instead of <Link to="/admin/users">, use:
<button onClick={() => navigate('/admin?tab=users')}>Users</button>

// Or with NavLink:
<NavLink to="/admin?tab=overview">Overview</NavLink>
<NavLink to="/admin?tab=users">Users</NavLink>
<NavLink to="/admin?tab=generations">Generations</NavLink>
<NavLink to="/admin?tab=pending">Pending</NavLink>
```

This makes tab state explicit, bookmarkable, shareable, and immune to future route naming conflicts. The `AdminRoute` wrapper at `/admin*` still protects everything — you can simplify the route structure down to a single `/admin` route once the tab logic moves to query params.

---

## ROADMAP ITEMS — Phased Priority Order

These are long-term improvements, not bugs. Prioritized by risk/value ratio:

### Priority 1 — Security (High Value, Non-Trivial)

**1a. JWT → httpOnly Cookie**

Currently: `localStorage.getItem('auth_token')` in `apiClient.ts` request interceptor.  
Risk: XSS can steal the token from localStorage.

Migration path:
```python
# backend: add cookie-based token endpoint
from fastapi import Response

@router.post("/login")
async def login(response: Response, ...):
    token = create_access_token(...)
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=True,         # HTTPS only
        samesite="strict",
        max_age=86400        # 24 hours
    )
    return {"message": "logged in"}
```

```ts
// frontend: remove Authorization header logic from interceptor
// Axios sends cookies automatically with withCredentials
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,   // ← sends the httpOnly cookie
});
// Remove the request interceptor that reads localStorage
```

Also remove `localStorage.setItem('auth_token', ...)` from `useAuthStore.login()` and replace with a `/me` endpoint call on app init.

**1b. Token Revocation for Suspended Users**

JWT is stateless — a suspended user with a valid token can still call any endpoint until the token expires (24 hours). For admin actions like suspension/ban to take effect immediately, add a DB check on sensitive routes:

```python
# dependencies.py
async def get_current_user_verified(request: Request):
    payload = get_current_user(request)       # decode JWT
    users_col = get_users_collection()
    user = await users_col.find_one({"_id": ObjectId(payload["user_id"])})
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account suspended")
    return payload
```

Apply `Depends(get_current_user_verified)` (not `get_current_user`) to `/generate` and any mutation endpoints. Keep the lighter `get_current_user` for read-only routes.

### Priority 2 — Reliability (High Value, Achievable Quickly)

**2a. LLM Retry with Exponential Backoff**

When the LLM returns malformed JSON, `_parse_and_validate()` in `llm_client.py` currently raises immediately. Add up to 2 retries before giving up:

```python
import asyncio

async def generate_slide_content(prompt: str, ..., max_retries: int = 2) -> dict:
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            raw = await asyncio.wait_for(
                asyncio.to_thread(_call_groq, prompt, ...),
                timeout=45.0
            )
            return _parse_and_validate(raw)
        except (ValueError, json.JSONDecodeError) as e:
            last_error = e
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)   # 1s, 2s
                continue
    raise last_error
```

**2b. Token Usage Tracking**

Groq SDK responses include `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`. Store these in `generation_logs` for cost attribution:

```python
# In _call_groq():
response = client.chat.completions.create(...)
return {
    "content": response.choices[0].message.content,
    "tokens": {
        "prompt": response.usage.prompt_tokens,
        "completion": response.usage.completion_tokens,
        "total": response.usage.total_tokens,
    }
}

# In generation_service.py, add to the log doc:
"tokens_used": result.get("tokens"),
"model_used": "groq" | "nvidia",
```

### Priority 3 — Quality (Medium Value)

**3a. Word-Boundary Technical Topic Detection**

Current detection in `llm_client.py` uses substring matching: `"api" in topics_lower`. This matches "happy", "rapid", "capital". Replace with word-boundary regex:

```python
import re

TECHNICAL_PATTERNS = [
    r'\bapi\b', r'\bml\b', r'\bai\b', r'\bdocker\b', r'\bkubernetes\b',
    r'\bgraphql\b', r'\brest\b', r'\bdevops\b', r'\bci/cd\b',
    r'\bpython\b', r'\bnode\.?js\b', r'\breact\b', r'\btypescript\b',
]

def _is_technical(topics: list[str]) -> bool:
    combined = " ".join(topics).lower()
    return any(re.search(p, combined) for p in TECHNICAL_PATTERNS)
```

**3b. Tone/TONE_CONFIG Alignment**

`PresentationRequest` accepts tones like `"executive"`, `"sales"`, `"simple"` that are not in `TONE_CONFIG`. This causes the LLM prompt to use the fallback tone silently. Either:
- Restrict `tone` field to a `Literal` of only tones in TONE_CONFIG, or
- Add the missing tones to TONE_CONFIG with appropriate prompt fragments.

**3c. Slide Quality Scorer**

After `_parse_and_validate()`, add a simple quality gate before storing the result:

```python
def _score_slide_quality(slides: list[dict]) -> float:
    issues = 0
    for slide in slides:
        content = " ".join(slide.get("bullets", []))
        if len(content) < 50:           issues += 1   # too short
        if "lorem ipsum" in content.lower(): issues += 1
        if content.count("...") > 2:    issues += 1   # placeholder
    return 1 - (issues / max(len(slides), 1))

# In generation pipeline:
quality = _score_slide_quality(parsed["slides"])
if quality < 0.7:
    raise ValueError(f"Low quality response (score={quality:.2f}), retrying...")
```

### Priority 4 — Frontend DX (Lower Risk, Improves Maintainability)

**4a. React ErrorBoundary**

Wrap the app root in an `ErrorBoundary` to prevent full-screen crashes from unhandled render errors:

```tsx
// components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020408] flex items-center justify-center text-[#00f0ff] font-['Share_Tech_Mono']">
          <div className="text-center">
            <div className="text-xl mb-4">SYSTEM ERROR — Core Process Failed</div>
            <button onClick={() => window.location.reload()}>REINITIALIZE</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// main.tsx:
<ErrorBoundary>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</ErrorBoundary>
```

**4b. Lazy Loading for Admin Routes**

The admin bundle includes Three.js, PPTX libraries, and all admin components even for regular users. Split with `React.lazy`:

```tsx
// App.tsx
const AdminView = React.lazy(() => import('./views/AdminView'));

// Wrap in Suspense:
<Route element={<AdminRoute />}>
  <Suspense fallback={<div>Loading admin...</div>}>
    <Route path="/admin" element={<AdminView />} />
  </Suspense>
</Route>
```

---

## ARCHITECTURE HEALTH — CURRENT STATE

```
skynet-ppt/
├── backend/
│   ├── core/           ✅ config, security, dependencies, converters
│   ├── db/             ✅ client singleton, async connect/close
│   ├── models/         ✅ typed requests, Literal fields, password constraints
│   ├── routers/        ✅ thin routers, auth on all writes, rate limiting
│   ├── services/       ✅ generation pipeline, cache, handle_cache_hit, storage
│   ├── shared/         ✅ THEME_DATA single source of truth
│   └── main.py         ✅ lifespan, CORS from property, clean imports
│
└── frontend/
    ├── api/            ✅ Axios client with interceptors, typed admin API
    ├── components/
    │   ├── auth/       ✅ AdminRoute guard
    │   └── layout/     ✅ MainLayout clean (no adminApi calls)
    ├── store/          ✅ Zustand, GenStep typed, no token param leak
    └── views/
        └── AdminView   🟡 pathname.includes tab resolution
```

**Strength areas:** Service layer separation, MongoDB consistency (GridFS + typed collections), JWT startup guard, CORS handling, frontend auth guards, Zustand store typing.

**Remaining attention areas:** JWT in localStorage (security), AdminView tab logic (fragility), retry logic (reliability).

---

## WHAT TO BUILD NEXT — PRIORITY ORDER

1. **Admin tab fix** (`AdminView.tsx`) — 15 minutes, zero risk, closes last open item
2. **LLM retry logic** — 30 minutes, prevents "bad JSON" user-facing errors
3. **Token usage tracking** — 1 hour, enables cost visibility and future quotas
4. **Word-boundary topic detection** — 20 minutes, prevents false positives on NVIDIA routing
5. **Tone/TONE_CONFIG alignment** — 30 minutes, prevents silent prompt degradation
6. **React ErrorBoundary** — 30 minutes, prevents full-app crash on render error
7. **Lazy admin routes** — 30 minutes, reduces initial bundle for non-admin users
8. **JWT httpOnly cookie** — 2–3 hours, full auth flow redesign, highest security value
9. **Token revocation DB check** — 1 hour, makes user suspension immediate
10. **Slide quality scorer** — 1 hour, filters low-quality LLM output before storage

---

## FINAL VERDICT

The Skynet PPT Generator is in **strong production shape** for the core generation and user-management flows. The three-phase review process has closed every critical and high-severity issue identified across architecture, backend, and frontend domains.

The codebase demonstrates clean separation of concerns, proper async patterns, typed models, and consistent security boundaries. The remaining items are all improvements and hardening — not blockers.

**Phase 4 Score: 25/26 items resolved (96%). Recommended for production deployment with the roadmap items tracked as engineering backlog.**

---

*Generated by Senior Engineering Review — Skynet PPT Generator v2.5.0*  
*Skills Applied: Senior Architect · Senior Backend · Senior Fullstack · Senior Frontend*
