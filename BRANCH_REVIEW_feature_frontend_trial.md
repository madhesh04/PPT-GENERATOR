# Code Review — `feature/frontend-trial` Branch

**Reviewed by:** Senior Engineering Panel (Architect · Backend · Frontend · Fullstack · QA)  
**Branch:** `feature/frontend-trial` (2 commits ahead of `main`)  
**Date:** 2026-04-19  
**Verdict:** 🟠 MERGE WITH CONDITIONS — 3 blockers + 8 high-priority fixes required

---

## What Was Fixed vs Main ✅

Before diving into issues, these critical items from the previous audit have been resolved in this branch:

| Item | Status |
|------|--------|
| Admin_Skynet hardcoded backdoor | ✅ REMOVED |
| `sanitize_filename` missing import | ✅ FIXED — properly imported from `core.utils` |
| `include_images` missing from Pydantic model | ✅ FIXED — `include_images: bool = Field(default=True)` |
| ErrorBoundary missing | ✅ IMPLEMENTED — full styled fallback page |
| History filter dropdowns non-functional | ✅ FIXED — search, type, and date filters all wired |
| Registration endpoint open | ✅ FIXED — returns 403 with clear message |
| `useDownload.ts` shared hook | ✅ CREATED — extracted from duplicate view logic |

---

## 🔴 Blockers — Fix Before Merge

### [B-01] Theme key mismatch crashes PPTX generation

**File:** `frontend/src/views/CreatorView.tsx` + `backend/core/themes.py`

The frontend sends `"oceanic"` as a theme value but the backend `THEME_DATA` only has the key `"ocean"` (no `ic`). Same issue: frontend sends `"neon"`, `"carbon"`, `"light"` — backend has `neon`, `ocean`, `emerald`, `royal`. The `carbon` and `light` themes exist in the frontend but have NO corresponding entry in `THEME_DATA`. The PPTX renderer will silently fall back or crash when it looks up a missing theme key.

**Fix:** Align theme keys on both sides. Either rename `"oceanic"` → `"ocean"` in `CreatorView.tsx` and add `carbon` and `light` entries to `THEME_DATA`, or vice versa. A one-line validator on the Pydantic model (`@field_validator("theme")`) would prevent silent fallback.

---

### [B-02] Dual toast system — silent failures in production

**Files:** `frontend/src/store/useAppStore.ts`, `frontend/src/components/ui/ToastContainer.tsx`, `frontend/src/hooks/useDownload.ts`

Two entirely separate toast implementations co-exist:
- `useAppStore.showToast(msg: string, dur?: number)` — string-only, no type variant, renders via `AppStore.toastData`
- `useToastStore.showToast(message, type: 'success' | 'error')` — typed, renders via `ToastContainer`

`useDownload.ts` uses `useAppStore.showToast` which has no `type` parameter — so download toasts never show a color or icon. `HistoryView` and `CreatorView` use `useToast()` from `ToastContainer`. The two systems are completely disconnected, so depending on the code path, toasts either appear styled or as a different unstyled element. Both toast containers potentially render simultaneously.

**Fix:** Delete `toastData` and `showToast` from `useAppStore`. Migrate `useDownload.ts` to use `useToastStore`. Single source of truth.

---

### [B-03] `PreviewView.tsx` is dead code with broken navigation

**File:** `frontend/src/views/PreviewView.tsx`

`PreviewView.tsx` exists in the `views/` folder and is referenced by the toast usage grep, but it is **not imported in `App.tsx`** and has **no route registered**. The component uses `navigate('/create')` which is correct, but it also still references `useAppStore.showToast` (the old system) and old CSS classes from the previous design system (`bg-[#2563EB]`, `material-symbols-outlined` icon font not loaded). This file will never render, but it increases bundle size and confuses future developers.

**Fix:** Delete `PreviewView.tsx` entirely. The post-generation flow in `CreatorView` handles the preview inline.

---

## 🟠 High Priority — Fix Within 24h of Merge

### [H-01] `CLAUDE_SONNET` engine in frontend has no backend support

**File:** `frontend/src/views/CreatorView.tsx` — `ENGINES` array

`{ value: 'claude', label: 'CLAUDE_SONNET' }` is exposed as a selectable AI engine. When a user picks it, `force_provider: 'claude'` is sent to the backend. The backend LLM router has no `claude` case — the value is silently ignored and falls back to the default provider. The user believes they're using Claude but they're not.

**Fix:** Remove the `CLAUDE_SONNET` entry from `ENGINES` until Claude is actually supported, or add it to `llm_client.py`.

---

### [H-02] `@vercel/analytics` on an internal employee tool

**Files:** `frontend/src/App.tsx` (imports `Analytics`), `package.json`

Vercel Analytics is tracking every page view and interaction by internal iamneo employees. This is an internal closed tool — employee activity should not be sent to Vercel's external servers. This is a data privacy issue and could violate internal data governance policies.

**Fix:** Remove `<Analytics />` from `App.tsx` and uninstall `@vercel/analytics`. If analytics are needed, use a self-hosted solution.

---

### [H-03] `dist/` folder committed to source control

**Path:** `frontend/dist/`

The compiled production build (`index.html`, `assets/index-*.js`, `assets/index-*.css`, `slide_previews/`) is committed to git. This inflates repo size, causes merge conflicts on every deploy, and makes it impossible to know which version of source produced a given build.

**Fix:** Add `frontend/dist/` to `.gitignore` and remove the existing committed dist files with `git rm -r --cached frontend/dist/`.

---

### [H-04] 5-second polling on Dashboard and History

**Files:** `DashboardView.tsx`, `HistoryView.tsx`

Both views use `setInterval(fetchData, 5000)` — constant polling every 5 seconds generating `/presentations/me?limit=100` and `/presentations/me?limit=500` calls. With 10 concurrent users, that's 120 MongoDB queries per minute for read operations that rarely change. This will noticeably impact DB performance and increase costs.

**Fix:** Remove the `setInterval`. Replace with: (1) a manual "Refresh" button with a `RefreshCw` icon that shows a spinner, and (2) re-fetch once when the view mounts. Real-time updates can be added via WebSocket later if needed.

---

### [H-05] Dead component files still in the repo

**Files:** `frontend/src/components/Cursor.tsx`, `frontend/src/components/SkynetBackground.tsx`, `frontend/src/components/ThreeBackground.tsx`, `frontend/src/components/Signup.tsx`

None of these are imported or used anywhere in `App.tsx` or any view. They're carry-overs from the old design system. `ThreeBackground.tsx` depends on `three.js` and `vanta` — both are still listed as runtime dependencies in `package.json` because of these dead files.

**Fix:** Delete all four files. Remove `three`, `vanta`, `@types/three` from `package.json`. This alone will reduce the JS bundle by an estimated 600–800KB.

---

### [H-06] `analytics.ts` has placeholder measurement ID

**File:** `frontend/src/lib/analytics.ts`

Line: `(window as any).gtag('config', 'GA_MEASUREMENT_ID', ...)` — `'GA_MEASUREMENT_ID'` is a literal placeholder string. This file is never imported anywhere in the current codebase, making it entirely dead code, but its presence suggests a half-finished integration.

**Fix:** Delete `analytics.ts` and `typography.ts` if unused (verify first). If they're planned for later, move them to a `_planned/` folder with a note.

---

### [H-07] Logout doesn't navigate to `/login`

**File:** `frontend/src/components/layout/Sidebar.tsx`

`logout()` clears `localStorage` and sets `isAuthenticated = false`, but the component doesn't call `navigate('/login')` afterwards. The user stays on the current page momentarily — `MainLayout` will catch the state change and redirect via its `useEffect`, but there's a visible flash of the authenticated shell before the redirect fires.

**Fix:** In the Sidebar logout handler:
```typescript
const { user, logout } = useAuthStore();
const navigate = useNavigate();
// ...
<button onClick={() => { logout(); navigate('/login'); }}>
```

---

### [H-08] `next-themes` and `framer-motion` are unused dependencies

**File:** `frontend/package.json`

`next-themes` (`^0.4.6`) — theme management is handled by `useAppStore.toggleTheme()` via class on `document.documentElement`. `next-themes` is never imported.

`framer-motion` (`^12.38.0`) — a 280KB+ dependency. Not imported in any view or component. The HTML design uses CSS `@keyframes` for all animations.

**Fix:** Uninstall both: `npm uninstall next-themes framer-motion`.

---

## 🟡 Medium Priority — Fix This Sprint

### [M-01] `handleDownload` still duplicated in DashboardView

**File:** `frontend/src/views/DashboardView.tsx`

`handleDownload(token, title)` is re-implemented inline in `DashboardView` using `apiClient.get('/download/${token}')` directly, instead of using the `useDownload()` hook or `presentationApi.downloadPresentation()`. The hook exists but isn't used here. Three separate download implementations still exist across the codebase.

**Fix:** Import and use `useDownload` in `DashboardView`.

---

### [M-02] `backend/failed_response.txt` committed to repo

**File:** `backend/failed_response.txt`

This is a debugging artifact (a raw failed LLM response that was saved during development). It should not be in source control.

**Fix:** `git rm backend/failed_response.txt` and add `*.txt` (or specifically `failed_response.txt`) to `.gitignore`.

---

### [M-03] `ppt-generator-v3_1.html` committed to repo root

**File:** `/ppt-generator-v3_1.html`

The design reference HTML file (75KB) is committed to the project root. It's a design artifact, not source code. In production this adds noise to the repo.

**Fix:** Move to `docs/design-reference.html` or remove from git with `git rm ppt-generator-v3_1.html`.

---

### [M-04] `VITE_API_BASE` env var naming inconsistency

**File:** `frontend/src/api/apiClient.ts`

The env var is read as `import.meta.env.VITE_API_BASE` but the Antigravity prompt specifies `VITE_API_URL`. The `.env` file should be checked to confirm which name is actually set. Mismatched env var name means `API_BASE` silently falls back to `'http://localhost:8001'` in production.

**Fix:** Pick one name (`VITE_API_URL` is more conventional) and use it consistently in `apiClient.ts`, `.env`, `.env.production`, `.env.example`, and all documentation.

---

### [M-05] `useAppStore` has `savedPresentations` with an `any[]` type

**File:** `frontend/src/store/useAppStore.ts`

`savedPresentations: any[]` — this was a carry-over from the old architecture where presentations were stored globally. They're now fetched locally in each view. The field is never written except by `setSavedPresentations`, which is never called. Dead state.

**Fix:** Remove `savedPresentations` and `setSavedPresentations` from `useAppStore`.

---

### [M-06] `AdminView` uses `confirm()` which is blocked in some browsers

**File:** `frontend/src/views/HistoryView.tsx` (also implicitly AdminView)

`if (!confirm('Delete this record?'))` — native `window.confirm()` is blocked in cross-origin iframes and has inconsistent styling. In Electron-based desktop apps or embedded webviews, it may not work at all.

**Fix:** Replace with an inline confirmation pattern (button state changes to "Confirm?" for 3 seconds before executing, then reverts — no modal needed).

---

### [M-07] `Content-Disposition` header still unquoted

**File:** `backend/routers/generate.py` — download endpoint

Verify this is fixed. If the download endpoint still uses:
```python
f"attachment; filename={filename}"
```
it must be changed to:
```python
f'attachment; filename="{filename}"'
```
Presentation titles with spaces will produce a malformed header.

---

## ✅ Architecture & Design — Solid Foundations

These are well-implemented and ready for production:

**Backend:**
- Dual MongoDB client pattern (skynet_db + Timesheet-Application) — clean lifespan management
- SHA-256 content deduplication with cache-hit cloning — avoids redundant LLM calls
- `asyncio.gather` + `asyncio.wait_for` with per-provider timeouts — robust pipeline
- Rate limiting on `/generate` and `/generate-notes` (10/min each) — appropriate
- Pydantic validators on tone (`Literal`-equivalent via set check) and topics (sanitise + require ≥1)
- `sanitize_filename` properly imported and implemented in `core/utils.py`
- JWT secret guard in startup — server won't boot with default placeholder

**Frontend:**
- `usePresentationStore` — well-typed, clear separation of UI state vs generation state
- `useAuthStore` — clean `initialize()` pattern, properly documented security trade-off
- `MainLayout` — correct auth guard with redirect-and-return pattern (`state: { from: location }`)
- `ErrorBoundary` — class component correctly wraps the entire app
- `SearchableDropdown` and `TagInput` — fully custom, matching design system exactly
- `ProgressOverlay` driven by store state — no prop drilling
- Sidebar active state logic — handles nested routes correctly via `startsWith`

---

## Bundle Audit — Estimated Savings

If the dead packages and files are removed:

| Item | Estimated Bundle Reduction |
|------|---------------------------|
| Remove `three.js` + `vanta` | ~700KB |
| Remove `framer-motion` | ~280KB |
| Remove `next-themes` | ~15KB |
| Delete dead component files | ~50KB |
| **Total** | **~1.0MB reduction** |

Current bundle is likely 1.8–2.2MB. After cleanup: ~800KB–1.2MB. Significant for a tool used over VPN or slower internal networks.

---

## Branch Merge Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│  🟠  MERGE WITH CONDITIONS                                       │
│                                                                  │
│  Fix B-01 (theme mismatch), B-02 (dual toast), B-03 (dead view) │
│  before merging to main. H-01 through H-08 should land in the   │
│  same PR or immediately after as a follow-up patch.              │
└─────────────────────────────────────────────────────────────────┘
```

**Estimated fix time for blockers:** 2–3 hours  
**Estimated fix time for high-priority:** 4–6 hours  
**Safe to merge after blockers resolved:** Yes

---

## Priority Fix Order

1. `B-01` — theme key mismatch (5 min fix, blocks all PPTX generation for 3 themes)
2. `B-02` — delete dual toast, migrate to `useToastStore` (30 min)
3. `B-03` — delete `PreviewView.tsx` (5 min)
4. `H-03` — gitignore `dist/`, remove committed build (5 min)
5. `H-05` — delete dead components + uninstall `three`/`vanta` (10 min, 700KB savings)
6. `H-08` — uninstall `framer-motion` + `next-themes` (5 min, 300KB savings)
7. `H-02` — remove Vercel Analytics (5 min)
8. `H-04` — remove 5-second polling (20 min)
9. `H-01` — remove Claude engine option (2 min)
10. `H-07` — add `navigate('/login')` to logout (2 min)
11. `M-02`, `M-03` — clean up committed artifacts (5 min)
12. `M-04` — standardize env var name (10 min across all files)

---

*Review based on full static analysis of `feature/frontend-trial`. All findings are from source code — no runtime profiling performed.*
