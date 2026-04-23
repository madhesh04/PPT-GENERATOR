# Skynet PPT Generator — Feature Implementation Spec
**Prepared for:** Antigravity (Implementation Team)  
**Prepared by:** Skynet Product Team  
**Source:** MoM dated 20-04-2026  
**Codebase reviewed:** 23-04-2026  
**Stack:** FastAPI (Python) + React 19 (TypeScript) + MongoDB Atlas + Zustand + Vite

---

## How to Read This Document

Each section maps directly to a MoM item. For each feature you will find:
- **What the existing code already does** — so you know where to extend, not rebuild
- **Exact files to touch** — backend router, model, service, and frontend view/store
- **Schema and API contract** — agreed shapes to implement
- **Acceptance criteria** — how to know it is done

The backend lives in `backend/` and is served from Render. The frontend lives in `frontend/src/` and is deployed on Vercel. The MongoDB database is `skynet_db` (app data) with a separate `Timesheet-Application` DB for user identity (read-only — do not write to it).

---

## Codebase Orientation

```
backend/
  core/          — config, security, dependencies (auth middleware)
  db/client.py   — Motor async MongoDB connections
  models/requests.py  — all Pydantic request models (add new models here)
  routers/
    auth.py      — POST /auth/login
    generate.py  — POST /generate, GET /presentations/me, etc.
    admin.py     — GET/PATCH /admin/*
  services/
    generation_service.py  — generation pipeline logic
    storage_service.py     — GridFS file save/retrieve
  llm_client.py  — Groq + NVIDIA routing
  generator.py   — python-pptx PPTX builder

frontend/src/
  api/
    apiClient.ts       — axios instance with JWT interceptor (base URL from VITE_API_URL)
    admin.ts           — admin API calls
    presentation.ts    — generation API calls
  store/
    useAuthStore.ts         — auth state (user, token, isAuthenticated)
    useAppStore.ts          — global settings (image gen toggle, dark mode)
    usePresentationStore.ts — full generation pipeline state
  views/
    CreatorView.tsx    — generation form
    DashboardView.tsx  — recent presentations
    HistoryView.tsx    — full archive with filters
    AdminView.tsx      — admin panel (users, generations, settings)
    SettingsView.tsx   — user settings
  components/
    ui/ToastContainer.tsx   — useToast() hook for success/error/info toasts
    ui/Badge.tsx            — coloured status badges
    ui/SearchableDropdown.tsx — custom dropdown with search
    layout/Sidebar.tsx      — navigation sidebar
```

**Authentication:** Every protected endpoint uses `Depends(get_current_user)` from `backend/core/dependencies.py`. Admin-only endpoints use `Depends(require_admin)`. The JWT payload contains `user_id` (employeeId string), `role` ("ADMIN" or "USER"), and `username`.

---

---

# Phase 1 — High Priority

---

## Feature 1 — Content Visibility (My Content / All Content Toggle)

### What exists today

`GET /presentations/me` filters strictly by `user_id == current_user["user_id"]`. The frontend `HistoryView.tsx` calls this endpoint with `?limit=500` and shows only the current user's archive.

### What to build

#### Backend

**New endpoint — `GET /presentations/all`**

```python
# File: backend/routers/generate.py  (add below /presentations/me)

@router.get("/presentations/all")
async def get_all_presentations(
    current_user: Annotated[dict, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Returns presentations from all users.
    Accessible to any authenticated user (view-only listing).
    """
    coll = get_presentations_collection()
    total = await coll.count_documents({})
    cursor = coll.find(
        {},
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "type": 1,
         "track": 1, "generated_by": 1, "username": 1}
    ).sort("created_at", -1).skip(skip).limit(limit)
    presentations = await cursor.to_list(length=limit)
    return {
        "presentations": serialize_mongo_doc(presentations),
        "total": total,
        "skip": skip,
        "limit": limit
    }
```

**Important:** The `generated_by` and `username` fields already exist in the `presentations` documents — both are written by `run_generation_pipeline()` in `generation_service.py`. No schema migration required for existing documents; old documents will simply have `null` for `generated_by`.

**Ensure `createdBy` is exposed consistently:** The document stores `generated_by` (display name) and `user_id` (employeeId). The `/presentations/all` endpoint should return `generated_by` in the response so the UI can show "Created by: Madhesh Prasath" on each row.

---

#### Frontend

**File:** `frontend/src/views/HistoryView.tsx`

Add a scope toggle at the top of the filters bar (next to the existing search input):

```tsx
// New state
const [scope, setScope] = useState<'mine' | 'all'>('mine');

// Fetch based on scope
const fetchHistory = async () => {
  const endpoint = scope === 'mine' ? '/presentations/me?limit=500' : '/presentations/all?limit=500';
  const r = await apiClient.get(endpoint);
  // ... existing logic
};

// Toggle UI (add to the filters row, left of search)
<div style={{ display: 'flex', gap: '4px', marginRight: '12px' }}>
  <button
    className={`ghost-btn${scope === 'mine' ? ' active' : ''}`}
    onClick={() => { setScope('mine'); setPage(1); }}
  >My Content</button>
  <button
    className={`ghost-btn${scope === 'all' ? ' active' : ''}`}
    onClick={() => { setScope('all'); setPage(1); }}
  >All Content</button>
</div>
```

When `scope === 'all'`, add a **Creator** column to the table between "Type" and "Track":

```tsx
// In <thead>
<th>Creator</th>

// In <tbody> row
<td className="mono-cell" style={{ fontSize: '11px' }}>{p.generated_by || '—'}</td>
```

In All Content mode, hide the Delete button for rows where `p.user_id !== currentUser.email` (users can see all but only delete their own). The backend ownership check already enforces this — the UI change is purely for UX clarity.

**New API function to add:**

```typescript
// File: frontend/src/api/presentation.ts
export const getAllPresentations = (params?: { skip?: number; limit?: number }) =>
  apiClient.get('/presentations/all', { params });
```

---

#### Acceptance Criteria

- [ ] Authenticated user sees "My Content" (default) and "All Content" toggle in HistoryView
- [ ] "All Content" shows presentations from all users with a Creator column
- [ ] Creator name is the `generated_by` display name (not the raw employeeId)
- [ ] Delete button is hidden/disabled for rows the user does not own in All Content mode
- [ ] Backend ownership check still prevents unauthorized deletes even if UI is bypassed

---

---

## Feature 2 — Access Control (RBAC Enforcement)

### What exists today

RBAC is partially implemented:
- `require_admin` dependency correctly gates all `/admin/*` routes
- Download and delete endpoints already have ownership checks (`user_id == current_user["user_id"]` or `is_admin`)
- Frontend `AdminRoute.tsx` component gates `/admin` route by role
- The role in the JWT is `"ADMIN"` or `"USER"`

### What to build

The MoM asks for: **users can only edit their own content; admins have full access**.

#### Backend

**Add `PATCH /presentations/{id}` — update a presentation (title, metadata only)**

```python
# File: backend/routers/generate.py

class UpdatePresentationRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    track: Optional[str] = None
    client: Optional[str] = None

@router.patch("/presentations/{presentation_id}")
async def update_presentation(
    presentation_id: str,
    body: UpdatePresentationRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    coll = get_presentations_collection()
    try:
        obj_id = ObjectId(presentation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid presentation ID")

    presentation = await coll.find_one({"_id": obj_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Not found")

    is_owner = presentation.get("user_id") == current_user["user_id"]
    is_admin = current_user.get("role", "").upper() == "ADMIN"

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="UNAUTHORIZED — Can only edit your own content")

    update_fields = {k: v for k, v in body.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc)
    update_fields["last_edited_by"] = current_user.get("username", current_user["user_id"])

    await coll.update_one({"_id": obj_id}, {"$set": update_fields})
    return {"status": "success"}
```

**Rule summary for all content endpoints:**

| Endpoint | USER | ADMIN |
|----------|------|-------|
| `GET /presentations/me` | ✅ own only | ✅ |
| `GET /presentations/all` | ✅ view all | ✅ |
| `PATCH /presentations/{id}` | ✅ own only | ✅ all |
| `DELETE /presentations/{id}` | ✅ own only | ✅ all |
| `GET /download/{id}` | ✅ own only | ✅ all |
| `GET /admin/*` | ❌ | ✅ |

No new middleware is needed — the existing `get_current_user` + manual role checks follow the correct pattern. Do not add a new middleware layer; keep it consistent with the existing approach.

#### Frontend

In `HistoryView.tsx`, when `scope === 'all'`, conditionally render action buttons based on ownership:

```tsx
const { user } = useAuthStore();
const isOwner = p.user_id === user?.email; // user_id = employeeId = email field
const isAdmin = user?.role === 'ADMIN';
const canEdit = isOwner || isAdmin;

// In actions column:
{canEdit && (
  <button className="action-btn action-btn-del" onClick={() => handleDelete(p.id)}>
    <Trash2 size={14} /> DEL
  </button>
)}
```

---

#### Acceptance Criteria

- [ ] `PATCH /presentations/{id}` returns 403 if user does not own the presentation
- [ ] Admin can patch/delete any presentation
- [ ] Edit and delete action buttons are hidden in the UI for presentations the user does not own
- [ ] Role checks are consistent across all content endpoints (see table above)

---

---

## Feature 9 — Content Metadata (`createdBy`, `createdAt`, `updatedAt`, `lastEditedBy`)

### What exists today

The `presentations` collection already stores:
- `user_id` (employeeId string)
- `generated_by` (display name string)
- `username` (display name string, duplicate of `generated_by`)
- `created_at` (datetime, UTC)

It does **not** store `updated_at` or `last_edited_by`.

### What to build

#### Backend

In `run_generation_pipeline()` (`backend/services/generation_service.py` line 139), the `new_doc` dict already has `created_at`. Add `updated_at` and `last_edited_by` to the initial insert:

```python
new_doc = {
    ...existing fields...,
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),    # ADD
    "last_edited_by": None,                       # ADD — null until first edit
}
```

The `PATCH /presentations/{id}` endpoint (Feature 2 above) already sets `updated_at` and `last_edited_by` on every edit — those fields are now complete.

Update the **projection** in `GET /presentations/me` and `GET /presentations/all` to include the new fields:

```python
{"_id": 1, "title": 1, "theme": 1, "created_at": 1, "updated_at": 1,
 "type": 1, "track": 1, "generated_by": 1, "last_edited_by": 1}
```

#### Frontend

In `HistoryView.tsx`, update the `Presentation` interface to include:

```typescript
interface Presentation {
  ...existing fields...
  updated_at?: string;
  last_edited_by?: string | null;
  generated_by?: string;
}
```

Show `updated_at` in the Generated At column when it differs from `created_at` (i.e., the presentation has been edited), with a small "edited" indicator:

```tsx
<td className="mono-cell">
  {formatTs(p.updated_at && p.updated_at !== p.created_at ? p.updated_at : p.created_at)}
  {p.last_edited_by && (
    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>
      (edited)
    </span>
  )}
</td>
```

---

#### Acceptance Criteria

- [ ] All new presentations have `updated_at` and `last_edited_by: null` on creation
- [ ] `updated_at` and `last_edited_by` are updated correctly after every `PATCH`
- [ ] `GET /presentations/me` and `GET /presentations/all` return `generated_by`, `updated_at`, `last_edited_by`
- [ ] HistoryView shows "edited" indicator for modified presentations

---

---

# Phase 2

---

## Feature 3 — Audit Logs

### What exists today

A `generation_logs` collection already exists in `skynet_db`. It currently records only `generate` and `generate_notes` actions. The `GET /admin/generations` endpoint does not expose these logs — it queries the `presentations` collection directly.

### What to build

#### Backend — new `audit_logs` collection

Create a separate `audit_logs` collection (different from `generation_logs` which is LLM-pipeline-specific).

**Add to `backend/db/client.py`:**

```python
def get_audit_logs_collection():
    return get_db().get_collection("audit_logs")
```

**Audit log schema (MongoDB document):**

```json
{
  "_id": "ObjectId",
  "action": "CREATE | UPDATE | DELETE | DOWNLOAD | EXPORT",
  "user_id": "employeeId string",
  "username": "display name string",
  "content_id": "presentation ObjectId as string",
  "content_title": "string — snapshot of title at time of action",
  "timestamp": "UTC datetime",
  "changes": {
    "field": { "before": "old value", "after": "new value" }
  },
  "ip_address": "string — optional, from request"
}
```

**Create a shared audit logging helper:**

```python
# File: backend/services/audit_service.py (new file)

from datetime import datetime, timezone
from db.client import get_audit_logs_collection

async def log_action(
    action: str,
    user: dict,
    content_id: str,
    content_title: str,
    changes: dict = None,
    ip: str = None
):
    coll = get_audit_logs_collection()
    await coll.insert_one({
        "action": action,
        "user_id": user.get("user_id"),
        "username": user.get("username", user.get("user_id")),
        "content_id": content_id,
        "content_title": content_title,
        "timestamp": datetime.now(timezone.utc),
        "changes": changes or {},
        "ip_address": ip
    })
```

**Wire up audit logging in existing endpoints:**

| Endpoint | Action to log |
|----------|---------------|
| `POST /generate` (after insert) | `"CREATE"` |
| `POST /generate-notes` (after insert) | `"CREATE"` |
| `PATCH /presentations/{id}` (new) | `"UPDATE"` with `changes` dict |
| `DELETE /presentations/{id}` | `"DELETE"` |
| `GET /download/{id}` | `"DOWNLOAD"` |
| `POST /export` | `"EXPORT"` |

Example — wire into the delete endpoint in `generate.py`:

```python
from services.audit_service import log_action

# After delete_one succeeds:
await log_action("DELETE", current_user, presentation_id, presentation.get("title", ""))
```

**New admin endpoint — `GET /admin/audit-logs`:**

```python
# File: backend/routers/admin.py

@router.get("/audit-logs")
async def admin_get_audit_logs(
    admin_user: Annotated[dict, Depends(require_admin)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None)
):
    coll = get_audit_logs_collection()
    query = {}
    if action:
        query["action"] = action.upper()
    if user_id:
        query["user_id"] = user_id

    total = await coll.count_documents(query)
    cursor = coll.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    return {
        "logs": serialize_mongo_doc(logs),
        "total": total
    }
```

#### Frontend — Audit Log tab in AdminView

`AdminView.tsx` already has a tab system. Add a new "Audit Logs" tab:

- Table columns: `#`, `Action`, `User`, `Content`, `Timestamp`, `Changes`
- `Action` displayed as a coloured `<Badge>`: CREATE = green, UPDATE = blue, DELETE = red, DOWNLOAD = purple
- Filterable by action type using the existing `SearchableDropdown` component
- Pagination using the existing pattern from `HistoryView.tsx`

This tab is admin-only (already gated by `AdminRoute` and `require_admin`).

---

#### Acceptance Criteria

- [ ] `audit_logs` collection exists with correct schema
- [ ] CREATE, UPDATE, DELETE, DOWNLOAD, EXPORT actions are all logged
- [ ] `changes` field is populated for UPDATE actions (before/after values)
- [ ] `GET /admin/audit-logs` is admin-only and supports `action` and `user_id` filters
- [ ] Audit log tab visible in AdminView (admin portal only)
- [ ] Existing `generation_logs` collection is not removed — it serves a separate purpose (LLM pipeline metrics)

---

---

## Feature 4 — Theme Fixes

### What exists today

Seven themes are defined in `backend/core/themes.py`: `neon`, `ocean`, `emerald`, `royal`, `dark`, `light`, `carbon`. The frontend `THEMES` array in `CreatorView.tsx` exposes six of these (dark is backend-only). The `ThemePreviewCard` component renders a miniature preview.

The MoM states "currently only Neo Light works" — this indicates a rendering bug in the PPTX output for non-light themes, not a UI issue.

### What to build

#### Backend — audit each theme's PPTX output

The `generator.py` file (341 lines) is the `python-pptx` builder. Each theme's `main`, `accent`, `text`, `surface` colour values are applied to slide backgrounds, title text, bullet text, and accent bars.

For each of the 7 themes, generate a test PPTX and verify:

1. Background colour is applied correctly (not default white)
2. Title text colour contrasts with the background
3. Accent bar colour renders
4. Bullet text is readable (sufficient contrast)

Known issue to check (`ARCHITECTURE_REVIEW_2026-04-23.md`, item R-03): the `dark` theme uses the same `main` and `accent` colours as `neon` — verify this is intentional or correct it.

#### Frontend — persist selected theme

Currently theme selection in `CreatorView.tsx` is stored in `usePresentationStore` which is reset on `resetCreation()`. The user's last-used theme is not remembered between sessions.

**Add to `useAppStore.ts`:**

```typescript
interface AppState {
  ...existing fields...
  preferredTheme: string;
  setPreferredTheme: (theme: string) => void;
}

// In create():
preferredTheme: localStorage.getItem('preferred_theme') || 'neon',
setPreferredTheme: (theme) => {
  localStorage.setItem('preferred_theme', theme);
  set({ preferredTheme: theme });
},
```

In `CreatorView.tsx`, initialize the theme selector from `useAppStore().preferredTheme` and call `setPreferredTheme` when the user changes it.

---

#### Acceptance Criteria

- [ ] All 7 themes produce visually correct PPTX output (correct colours on background, text, accents)
- [ ] `dark` theme clarified — either visually distinct from `neon` or removed from `THEME_DATA` and the validator
- [ ] Selected theme persists across page reloads via `localStorage`
- [ ] Theme preview cards in `CreatorView.tsx` accurately reflect the actual PPTX output colours

---

---

# Phase 3

---

## Feature 5 — QC / Validation System

### What exists today

No QC/validation step exists. Generated content is returned directly from the LLM with structural validation (`_validate_data` in `llm_client.py`) that only checks for required fields, not content quality.

### Phase 1 — Structural Validation (implement first)

#### Backend

Add a validation step inside `run_generation_pipeline()` in `generation_service.py`, after the LLM response is received and before the DB insert:

```python
def validate_presentation_structure(slides: list, num_slides_requested: int) -> dict:
    issues = []
    
    if len(slides) < num_slides_requested:
        issues.append(f"Expected {num_slides_requested} slides, got {len(slides)}")
    
    for i, slide in enumerate(slides):
        if not slide.get("title") or not slide["title"].strip():
            issues.append(f"Slide {i+1}: missing title")
        bullets = slide.get("content", [])
        if len(bullets) < 3:
            issues.append(f"Slide {i+1}: only {len(bullets)} bullets (minimum 3)")
        if any(len(b.strip()) < 10 for b in bullets if b.strip()):
            issues.append(f"Slide {i+1}: contains suspiciously short bullet points")
    
    score = max(0, 100 - (len(issues) * 10))
    return {"score": score, "issues": issues, "passed": score >= 70}
```

Include the validation result in the API response:

```python
# In run_generation_pipeline(), after _validate_data:
qc_result = validate_presentation_structure(presentation_data, body.num_slides)

# Add to response dict:
return {
    ...existing fields...,
    "qc": qc_result
}
```

Store `qc_result` in the MongoDB document as well for admin visibility.

#### Frontend

In `CreatorView.tsx`, after generation completes, if `result.qc` is present and `result.qc.score < 100`, show a dismissable warning card above the slide preview:

```tsx
{result?.qc && result.qc.issues.length > 0 && (
  <div className="qc-warning-card">
    <div className="qc-score">QC Score: {result.qc.score}/100</div>
    <ul>
      {result.qc.issues.map((issue, i) => <li key={i}>{issue}</li>)}
    </ul>
  </div>
)}
```

---

### Phase 2 — Dual-AI Validation (implement after Phase 1 is stable)

#### Backend

Add a second LLM call that reviews the generated content. Use whichever provider was **not** used for generation (natural cross-validation):

```python
# File: backend/services/qc_service.py (new file)

async def ai_quality_check(slides: list, title: str, secondary_provider: str) -> dict:
    """
    Sends generated slides to a second AI model for quality review.
    Returns score (0-100) and list of issues found.
    """
    slides_summary = "\n".join([
        f"Slide {i+1}: {s['title']} — {'; '.join(s.get('content', []))}"
        for i, s in enumerate(slides)
    ])

    prompt = f"""You are a content quality reviewer.
Review this presentation titled "{title}" and evaluate:
1. Factual accuracy of claims
2. Completeness of explanations  
3. Logical flow between slides
4. Whether bullets are substantive (not generic filler)

Content to review:
{slides_summary}

Return ONLY a JSON object:
{{"score": <0-100>, "issues": ["issue1", "issue2"]}}
JSON only, no markdown."""

    # Route to secondary provider (opposite of generation provider)
    # Use existing _call_groq / _call_nvidia infrastructure
    ...
    return {"score": score, "issues": issues}
```

The QC call should be wrapped in `asyncio.wait_for(..., timeout=30.0)` and failures should be graceful — if QC times out, return `{"score": null, "issues": [], "qc_status": "unavailable"}` and do not fail the generation.

#### API Response shape (Phase 2)

```json
{
  "title": "...",
  "slides": [...],
  "theme": "neon",
  "token": "...",
  "filename": "...",
  "qc": {
    "score": 85,
    "issues": ["Slide 3: missing explanation for the formula presented"],
    "qc_status": "complete",
    "reviewed_by": "nvidia"
  }
}
```

---

#### Acceptance Criteria — Phase 1

- [ ] Every generation response includes a `qc` object with `score` and `issues`
- [ ] `qc` object is stored in the MongoDB presentation document
- [ ] If score < 70, a warning is shown in the UI with the specific issues listed
- [ ] QC failures do not block the generation — the user still gets their slides

#### Acceptance Criteria — Phase 2

- [ ] Secondary AI model reviews generated content
- [ ] QC call does not increase P95 generation latency by more than 5 seconds (run concurrently or async)
- [ ] If QC service fails/times out, generation still completes successfully with `qc_status: "unavailable"`

---

---

## Feature 7 — Reference Inputs (URLs, Documents, Free Text)

### What exists today

`POST /upload-context` (`generate.py` line 182) already accepts a file upload and returns extracted text via `services/file_extractor.py`. The extracted text is passed as the `context` field in `PresentationRequest`. The LLM prompt already has a context block (`context_block` in `llm_client.py` line 89).

`file_extractor.py` handles PDF (`pypdf`), DOCX (`python-docx`), and plain text. URL extraction is not implemented.

### What to build

#### Backend — add URL extraction

**Add to `backend/services/file_extractor.py`:**

```python
import httpx
from html.parser import HTMLParser

class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_parts = []
        self._skip = False
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'nav', 'footer', 'header'):
            self._skip = True
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'footer', 'header'):
            self._skip = False
    def handle_data(self, data):
        if not self._skip and data.strip():
            self.text_parts.append(data.strip())

async def extract_text_from_url(url: str) -> str:
    """Fetch URL and extract readable text content. Max 10,000 chars."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
        parser = _TextExtractor()
        parser.feed(r.text)
        text = " ".join(parser.text_parts)
        return text[:10000]  # cap at 10k chars to stay within prompt limits
    except Exception as e:
        raise ValueError(f"Could not fetch URL: {e}")
```

**New endpoint — `POST /extract-url`:**

```python
# File: backend/routers/generate.py

class UrlExtractRequest(BaseModel):
    url: str = Field(..., min_length=5, max_length=500)

@router.post("/extract-url")
async def extract_from_url(
    body: UrlExtractRequest,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    from services.file_extractor import extract_text_from_url
    try:
        text = await extract_text_from_url(body.url)
        return {"text": text, "source": body.url}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
```

The existing `POST /upload-context` endpoint already handles file uploads — no changes needed there.

#### Frontend — Reference Input UI in CreatorView

The context textarea in `CreatorView.tsx` currently accepts free text. Extend it with a tabbed reference input panel:

**Tab 1: Free Text** — existing textarea (no change)

**Tab 2: Upload File** — a file picker that calls `POST /upload-context`, receives extracted text, and appends it to the context field. Supported types: `.pdf`, `.docx`, `.txt`. This upload endpoint already exists — only the UI is new.

**Tab 3: From URL** — a URL input that calls `POST /extract-url` and appends the extracted text to the context field.

All three tabs write to the same `context` field in `usePresentationStore`. The UI just provides different input modalities that all funnel into the same prompt field.

Show character count on the context field (`context.length / 5000` limit as set in `PresentationRequest`).

---

#### Acceptance Criteria

- [ ] `POST /extract-url` extracts readable text from a given URL (min: works for standard HTML pages)
- [ ] Extracted URL text is capped at 10,000 characters before being included in context
- [ ] File upload (existing) and URL extraction (new) both populate the `context` field
- [ ] Context character count is shown in the UI
- [ ] Unsupported file types return a clear error message

---

---

## Feature 8 — Expectations Section (Tone, Depth, Slide Count)

### What exists today

`PresentationRequest` already has:
- `tone` (validated: professional, executive, technical, academic, sales, simple, creative) — displayed in CreatorView
- `num_slides` (2-15, default 5) — displayed in CreatorView
- `context` field accepts free-text audience/depth instructions

`NotesRequest` already has:
- `depth` (summary/standard/deep) — exists in the model but UI exposure is unclear

### What to build

The MoM asks to standardise these fields, store them with the content, and ensure consistent output. Most of the backend work is already done. The gaps are in the **frontend presentation** and **consistent storage**.

#### Backend

Verify `tone`, `num_slides`, and `depth` (for notes) are stored in the MongoDB document and returned in list endpoints. Currently `num_slides` is not explicitly stored (only the resulting `slides` array is stored). Add it:

```python
# In run_generation_pipeline(), new_doc dict:
"num_slides_requested": body.num_slides,  # ADD — for audit/display
"tone": body.tone,                         # already stored implicitly via body fields? confirm
```

For notes, ensure `depth` and `format` are stored in the `new_doc` in `generate_notes` router:

```python
"depth": body.depth,
"format": body.format,
```

#### Frontend

In `CreatorView.tsx`, the tone and slide count controls already exist. Ensure they are:

1. **Visible by default** — not hidden behind an "Advanced" section
2. **Labelled clearly** — "Tone" and "Number of Slides" should be prominent, not secondary
3. **Reflected in the result view** — after generation, show a metadata summary: "Generated with: Technical tone · 8 slides · Groq Llama 3.3"

For **Notes** (`generateLectureNotes` in the store), the depth (summary/standard/deep) and format (prose/bullets/Q&A) fields must be exposed in the CreatorView notes tab with clear labels, not just sent as raw API parameters.

---

#### Acceptance Criteria

- [ ] `tone`, `num_slides`, `depth`, `format` are stored in MongoDB documents
- [ ] These fields are returned in list endpoints (for admin visibility)
- [ ] All expectation fields visible in CreatorView without needing to expand advanced settings
- [ ] Post-generation result shows a metadata summary line with the settings used

---

---

# Phase 4

---

## Feature 6 — Content Structuring (Series)

### What exists today

No series concept exists. Presentations are independent documents.

### What to build

#### Backend — new `series` collection

**Add to `backend/db/client.py`:**

```python
def get_series_collection():
    return get_db().get_collection("series")
```

**Series document schema:**

```json
{
  "_id": "ObjectId",
  "title": "string — Series title",
  "description": "string — optional",
  "created_by": "employeeId",
  "created_by_name": "display name",
  "created_at": "UTC datetime",
  "updated_at": "UTC datetime",
  "modules": [
    {
      "ppt_id": "presentation ObjectId as string",
      "ppt_title": "string — snapshot",
      "order": 1
    }
  ],
  "track": "string — optional",
  "client": "string — optional"
}
```

**New router — `backend/routers/series.py`:**

```python
# Endpoints to implement:

POST   /series                     — create a new series (authenticated)
GET    /series                     — list all series (authenticated)
GET    /series/{series_id}         — get a series with full module list
PATCH  /series/{series_id}         — update title/description (owner or admin)
DELETE /series/{series_id}         — delete series (owner or admin)
POST   /series/{series_id}/modules — add a presentation to a series
DELETE /series/{series_id}/modules/{ppt_id}  — remove from series
PATCH  /series/{series_id}/modules/reorder  — update module order
```

Apply the same ownership pattern: `created_by == current_user["user_id"]` or `is_admin`.

Register the new router in `backend/main.py`:
```python
from routers import auth, generate, admin, series
app.include_router(series.router)
```

#### Frontend — Series UI

Add a new **Series** view:

- Route: `/series` — add to `App.tsx` routes and `Sidebar.tsx` navigation
- List view: cards showing series title, module count, creator, last updated
- Detail view: ordered list of modules with drag-to-reorder (or up/down buttons as a simpler alternative)
- "Add to Series" button on each presentation card in DashboardView and HistoryView

---

#### Acceptance Criteria

- [ ] Series can be created, viewed, edited, and deleted
- [ ] Presentations can be added to a series and their order maintained
- [ ] Series list is visible to all authenticated users
- [ ] Only the series creator (or admin) can modify or delete a series
- [ ] Series view linked from the sidebar navigation

---

---

## Feature 10 — User Retention Features

### What exists today

- `DashboardView.tsx` already shows recent presentations (fetches the last few from `/presentations/me`)
- `HistoryView.tsx` has search by title and type filter
- No edit-in-place capability
- No global search across all content

### What to build

#### 1. Edit Existing Presentation Title / Metadata

Use the `PATCH /presentations/{id}` endpoint built in Feature 2. In `HistoryView.tsx`, add an edit icon button next to the delete button that opens an inline edit form for `title` and `track`.

#### 2. Global Search

Add `GET /presentations/search` endpoint:

```python
@router.get("/presentations/search")
async def search_presentations(
    q: str = Query(..., min_length=2, max_length=100),
    scope: str = Query("mine"),  # "mine" or "all"
    current_user: Annotated[dict, Depends(get_current_user)] = None
):
    coll = get_presentations_collection()
    query = {"title": {"$regex": q, "$options": "i"}}
    if scope == "mine":
        query["user_id"] = current_user["user_id"]
    
    cursor = coll.find(
        query,
        {"_id": 1, "title": 1, "theme": 1, "created_at": 1, "type": 1, "generated_by": 1}
    ).sort("created_at", -1).limit(20)
    
    results = await cursor.to_list(length=20)
    return {"results": serialize_mongo_doc(results)}
```

The existing search in `HistoryView.tsx` is client-side (filters already-fetched data). The new endpoint enables server-side search across all content, which is needed once the dataset grows beyond what a single page fetch covers.

#### 3. Recent Activity Section in Dashboard

`DashboardView.tsx` should show the last 5 actions across the user's content (generated, edited, downloaded). Source this from the `audit_logs` collection via a new endpoint:

```python
@router.get("/my/activity")
async def get_my_activity(
    current_user: Annotated[dict, Depends(get_current_user)],
    limit: int = Query(5, ge=1, le=20)
):
    coll = get_audit_logs_collection()
    cursor = coll.find({"user_id": current_user["user_id"]}).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    return {"activity": serialize_mongo_doc(logs)}
```

#### 4. Navigation UX Improvements

The Sidebar currently shows: Dashboard, Creator, History, Settings, Admin (admin only).

Add: **Series** (Phase 4 feature).

Ensure the active route is highlighted (it is — Sidebar uses `useLocation()` to determine the active path, confirmed in `Sidebar.tsx`).

---

#### Acceptance Criteria

- [ ] Presentation title and track can be edited inline from HistoryView
- [ ] Server-side search returns results within 500ms for a dataset of up to 10,000 presentations
- [ ] Dashboard shows recent activity feed (last 5 actions by the user)
- [ ] Series link appears in the sidebar once Feature 6 is implemented

---

---

# API Contract Summary

The complete list of new endpoints to implement, for alignment between backend (Sriram) and frontend (Andrew):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/presentations/all` | USER+ | All presentations, paginated |
| `PATCH` | `/presentations/{id}` | USER+ | Update title/track (owner or admin) |
| `GET` | `/presentations/search` | USER+ | Full-text search with scope param |
| `GET` | `/my/activity` | USER+ | Recent audit log for current user |
| `POST` | `/extract-url` | USER+ | Extract text from URL for context |
| `GET` | `/admin/audit-logs` | ADMIN | Audit log with action/user filters |
| `POST` | `/series` | USER+ | Create a new series |
| `GET` | `/series` | USER+ | List all series |
| `GET` | `/series/{id}` | USER+ | Series detail with modules |
| `PATCH` | `/series/{id}` | USER+ (owner/admin) | Update series metadata |
| `DELETE` | `/series/{id}` | USER+ (owner/admin) | Delete series |
| `POST` | `/series/{id}/modules` | USER+ (owner/admin) | Add PPT to series |
| `DELETE` | `/series/{id}/modules/{ppt_id}` | USER+ (owner/admin) | Remove PPT from series |
| `PATCH` | `/series/{id}/modules/reorder` | USER+ (owner/admin) | Update module order |

**Existing endpoints that need modification:**

| Endpoint | Change |
|----------|--------|
| `run_generation_pipeline()` | Add `qc`, `updated_at`, `last_edited_by: null`, `num_slides_requested`, `tone` to stored document |
| `DELETE /presentations/{id}` | Wire `audit_service.log_action("DELETE", ...)` |
| `GET /download/{id}` | Wire `audit_service.log_action("DOWNLOAD", ...)` |
| `POST /generate` | Wire `audit_service.log_action("CREATE", ...)` |

---

# Environment & Deployment Notes

- All new routes follow the existing pattern: `Depends(get_current_user)` for authentication, `Depends(require_admin)` for admin-only routes
- All new MongoDB collections are initialised at startup in the `lifespan()` function in `main.py` — add index creation there
- Recommended new indexes:
  - `audit_logs`: `{ "user_id": 1, "timestamp": -1 }`
  - `audit_logs`: `{ "content_id": 1 }`
  - `series`: `{ "created_by": 1 }`
  - `presentations`: `{ "title": "text" }` — for server-side search
- The `VITE_API_URL` environment variable on Vercel must point to the Render backend URL — no changes needed for new endpoints since they share the same base URL
- Do not modify the `Timesheet-Application` database at any point — it is a shared external database, read-only

---

*Spec prepared from MoM dated 20-04-2026 and verified against codebase reviewed 23-04-2026.*
