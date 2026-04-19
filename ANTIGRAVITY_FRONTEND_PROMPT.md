# Antigravity Prompt — Skynet PPT Generator Frontend Rebuild

---

## CONTEXT

You are rebuilding the **entire frontend** of a React SaaS application called **Skynet PPT Generator** — an internal AI-powered presentation tool used by iamneo / Q Labs employees.

You will be given two reference artifacts:
1. **This prompt** — authoritative specification of all functionality, data flow, and constraints
2. **`ppt-generator-v3_1.html`** — the pixel-perfect design reference. Every color, spacing, component shape, animation, and layout decision in that file is final and must be reproduced exactly in React.

---

## ABSOLUTE DESIGN RULE

> **Do not deviate from the design in `ppt-generator-v3_1.html` by a single pixel.**

- Every CSS variable defined in that file maps 1:1 to a design token in your implementation.
- Every component (sidebar, topbar, cards, tables, badges, toggles, progress overlay, toasts) must be reproduced exactly as shown.
- The **only exception** is the **Login / Auth page** — do **not** touch `AuthView.tsx`. Leave it entirely as-is.
- Do not introduce new colors, fonts, border radii, spacing values, or layout patterns that are not in the HTML file.

---

## TECH STACK — DO NOT CHANGE

- **React 19** + **TypeScript** (strict mode)
- **Vite 7**
- **React Router v7** (SPA routing, `createBrowserRouter`)
- **Zustand v5** (3 stores: `useAuthStore`, `useAppStore`, `usePresentationStore`)
- **Tailwind CSS v4** (used for layout utilities only — all design-critical styles in CSS variables / CSS modules)
- **Axios** via a shared `apiClient` instance (`src/api/client.ts`)

---

## DESIGN TOKEN SYSTEM

Extract these exact CSS custom properties from the HTML and define them globally in `src/index.css` or a dedicated `src/styles/tokens.css`:

```css
:root {
  --bg-primary:    #0d0f14;
  --bg-secondary:  #13161e;
  --bg-surface:    #1a1d27;
  --bg-surface-hi: #1f2330;
  --bg-raised:     #22263a;
  --border:        rgba(37,40,54,0.8);
  --border-faint:  rgba(37,40,54,0.45);
  --text-primary:  #f0f2f8;
  --text-secondary:#8892b0;
  --text-muted:    #4a5068;
  --accent:        #0325BD;
  --accent-hi:     #1530c4;
  --accent-glow:   rgba(3,37,189,0.18);
  --accent-text:   #d1d1f1;
  --green:         #22d3a5;
  --yellow:        #f5c542;
  --red:           #ef4444;
  --purple:        #a855f7;
  --sidebar-w:     56px;
  --topbar-h:      52px;
  --statusbar-h:   26px;
  --font:          'Nunito', sans-serif;
  --mono:          'JetBrains Mono', monospace;
  --r-sm:  8px;
  --r-md:  12px;
  --r-lg:  16px;
  --r-pill:9999px;
}
```

Google Fonts import (add to `index.html`):
```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
```

---

## APP SHELL LAYOUT

The app shell (applies to all authenticated routes) is a **fixed 3-region layout**:

```
┌──────┬────────────────────────────────────────┐
│      │  TOPBAR (52px, fixed)                  │
│ SIDE │────────────────────────────────────────│
│ BAR  │                                        │
│ 56px │  PAGE CONTENT (scrollable)             │
│      │                                        │
│      │────────────────────────────────────────│
│      │  STATUS BAR (26px, fixed bottom)       │
└──────┴────────────────────────────────────────┘
```

### Sidebar (`AppSidebar.tsx`)
- Fixed width 56px, full height, `var(--bg-secondary)` background
- Right edge: 1px gradient border (transparent → `var(--border)` → transparent)
- **Top:** Logo mark — 36px square, `border-radius: 10px`, gradient `#0325BD → #1530c4`, pulsing glow animation (`logo-pulse` keyframe from HTML), margin-bottom 18px
- **Nav group** (flex column, gap 3px, takes remaining space):
  - Each nav item: 38×38px icon button, `var(--r-sm)` radius
  - Hover: `var(--bg-surface)` background, `var(--accent-text)` color
  - Active: `rgba(3,37,189,0.12)` background + `inset 0 0 0 1px rgba(3,37,189,0.2)` box-shadow + left edge indicator (2px accent bar with glow, positioned `left: -10px`)
  - Tooltip on hover: absolutely positioned pill to the right showing page name
  - Icons (Lucide): Dashboard→`LayoutDashboard`, Create→`Sparkles`, History→`Clock`, Settings→`Settings`, Admin→`Shield` (admin-only)
- **Bottom group:**
  - Theme toggle pill (30×52px, dark/light indicator — dark mode only for now, keep as decorative)
  - Logout button (32×32px, red tint, `LogOut` icon)

### Topbar (`AppTopbar.tsx`)
- Fixed height 52px, `var(--bg-secondary)`, bottom gradient border
- Left: brand mark — blinking green dot + `SKYNET` label (12px, 800 weight, 0.12em letter-spacing, uppercase) + separator + current page name (12px, 700, accent-text)
- Right: user pill (avatar initials circle + user display name)

### Status Bar (`AppStatusBar.tsx`)
- Fixed, `bottom: 0`, `left: var(--sidebar-w)`, height 26px
- Background: `rgba(13,15,20,0.95)` + `backdrop-filter: blur(8px)`
- Shows: `● SKYNET v3.0`, `● GROQ LLM`, `● DB CONNECTED` (with colored dots as in HTML)
- All text: `var(--mono)`, 10px, `var(--text-muted)`

---

## ROUTING STRUCTURE

```
/                   → AuthView (login — DO NOT MODIFY)
/app                → AppShell (authenticated wrapper)
  /app/dashboard    → DashboardView
  /app/create       → CreateView
  /app/history      → HistoryView
  /app/settings     → SettingsView
  /app/admin        → AdminView (admin role only, guarded)
```

- `AppShell` checks auth from `useAuthStore`. If not authenticated → redirect to `/`.
- `AdminView` additionally checks `role === 'admin'`. If not admin → redirect to `/app/dashboard`.
- On first load after login, redirect to `/app/dashboard`.

---

## VIEW SPECIFICATIONS

---

### 1. DashboardView (`/app/dashboard`)

**Page header:** `LayoutDashboard` icon + title "Dashboard" + right-side action: `+ New Presentation` primary button (navigates to `/app/create`)

#### KPI Row (4 cards, `kpi-grid` layout)
Bind these to real data from `usePresentationStore` / API:

| Card | Icon | Color | Value | Delta label |
|------|------|-------|-------|-------------|
| Total Presentations | `FilePresentation` | blue | `presentations.length` | "All time" |
| This Week | `TrendingUp` | green | count of presentations created in last 7 days | "Last 7 days" |
| Avg Slides | `Layers` | purple | average `num_slides` across all presentations | "Per deck" |
| Success Rate | `CheckCircle` | yellow | percentage of `status === 'completed'` | "Completion" |

#### Activity Chart (left of dash-lower grid)
- Mini vertical bar chart (7 bars = last 7 days)
- Bars filled proportionally to number of presentations created that day
- Today's bar uses `linear-gradient(to top, #0325BD, #1530c4)` with glow
- Labels: `Mon`, `Tue`… `Today`

#### Recent Presentations Table (full-width in dash-lower)
Columns: `#` (mono, accent-text entry ID), `Title`, `Topics`, `Slides`, `Theme` (badge), `Status` (badge), `Created` (mono date), `Actions` (download + delete buttons)

**Badge colors:**
- Status `completed` → `badge-green`
- Status `processing` → `badge-yellow`  
- Status `failed` → `badge-red`
- Theme names → `badge-blue`

**Actions:**
- Download button (`action-btn-dl`): calls `GET /presentations/{id}/download`, triggers file save
- Delete button (`action-btn-del`): calls `DELETE /presentations/{id}`, confirms with inline confirmation before firing

**Table footer:** "Showing N of Total records" + pagination buttons (Previous / 1 / 2 / … / Next)

---

### 2. CreateView (`/app/create`)

**Page header:** `Sparkles` icon + title "Create"

#### Tab Strip
Two tabs side-by-side (pill-style tab bar):
- **PPT Presentation** (`Presentation` icon) — default active
- **Lecture Notes** (`BookOpen` icon)

---

#### Tab 1: PPT Presentation

Two-column layout: `1fr 360px`

**Left column — field blocks (numbered):**

| # | Field | Component |
|---|-------|-----------|
| 01 | Presentation Title | `text-input`, placeholder "e.g. Introduction to Machine Learning" |
| 02 | Topics / Key Points | Tag input — user types a topic and presses Enter or comma to add tag; backspace removes last tag; max 10 tags; hint shows "N/10 added" |
| 03 | Context / Brief | `textarea-input`, 4 rows, max 5000 chars; char counter bottom-right |
| 04 | Number of Slides | Slider (range 2–15) with numeric display box on left |

Below fields: **Generate Presentation** button (full-width, pill, pulsing gradient animation from HTML). Disabled + shows spinner while generating.

**Right column — config panel (3 cards):**

**Card 1 — Tone**
6 tone chips in 2×3 grid:
- `Professional`, `Creative`, `Technical`, `Educational`, `Academic`, `Executive`
- Single-select; `Professional` active by default
- Map "Executive" → send as `"professional"` to backend (backend limitation — note in code comment)

**Card 2 — Theme**
4 theme preview cards in 2×2 grid, each showing a miniature slide layout preview using the HTML's `.theme-preview` pattern:
- `Neon`, `Corporate`, `Minimal`, `Dark`
- Single-select; `Neon` active by default
- Each card has a colored micro-preview matching the theme palette

**Card 3 — AI Engine**
3 engine rows with radio selection:
- **Auto** (blue icon, `Zap`) — "Smart routing, recommended" — default
- **Groq** (purple icon, `Cpu`) — "Llama 3.3 70B, fast"
- **NVIDIA NIM** (green icon, `Microchip`) — "Technical topics, precise"
- Selected row: `rgba(3,37,189,0.07)` background + accent border

**Generation flow:**
1. Validate: title required, at least 1 topic required
2. Set `usePresentationStore.isGenerating = true`, show **Progress Overlay**
3. `POST /generate` with `{ title, topics, num_slides, context, tone, theme, force_provider, include_images: true }`
4. Progress overlay cycles through steps with animated percentage (fake progress theatre matching the store's existing step system — keep as-is)
5. On success: dismiss overlay, show success toast, navigate to `/app/history`
6. On error: dismiss overlay, show error toast with message

**Progress Overlay** (modal, `position: fixed`, `backdrop-filter: blur(12px)`):
- Top accent line: `linear-gradient(90deg, #0325BD, #22d3a5)`
- Title, sub-label, animated progress bar, large percentage counter (JetBrains Mono, 34px), stage label, 3-dot bounce animation
- Steps: "Initializing...", "Writing content...", "Designing slides...", "Rendering assets...", "Finalizing..."

---

#### Tab 2: Lecture Notes

Two-column layout: `1fr 320px`

**Left column:**
- Field blocks (same numbered style): Subject/Topic, Key Concepts (tag input), Additional Context (textarea)
- **Live Preview Card** below: shows formatted lecture notes in real-time once generated. Empty state shows centered icon + "Generate notes to see preview". Generated content shows section titles in `var(--accent-text)` with body text and blue left-border bullets.

**Right column — config cards:**
- **Detail Level** — 3 depth pills: `Brief`, `Standard`, `Detailed`
- **Format** — 2×2 grid: `Bullet Points`, `Paragraphs`, `Mixed`, `Cornell`
- **Language** — text input (default "English")
- **Export** — toggle switches: "Include Examples", "Include Summary"
- Generate button: teal/cyan gradient (`#22d3a5 → #0ea5e9`), full-width pill

**Generation flow:** `POST /generate/notes` (or equivalent endpoint). Show loading skeleton in preview card while generating. On success, render formatted content in preview card. Provide "Copy" and "Download .txt" action buttons in the preview card header.

---

### 3. HistoryView (`/app/history`)

**Page header:** `Clock` icon + title "History" + right: `RefreshCw` ghost button to reload

#### KPI Row (4 cards):
| Card | Value |
|------|-------|
| Total Generated | all-time count |
| This Month | current month count |
| Avg Generation Time | average in seconds (from metadata if available, else "—") |
| Storage Used | rough estimate based on count (or "—") |

#### Filters Row
Three functional filters (all must be wired with `onChange` — no dead dropdowns):
1. **Search** — text input with search icon; filters table rows by title in real-time (client-side)
2. **Status filter** — searchable dropdown (`sd-wrap` pattern from HTML): All / Completed / Processing / Failed
3. **Date range** — date range picker (`dr-pill` pattern from HTML) with Quick chips: Today / 7d / 30d / All

All three filters combine (AND logic) to filter the `presentations` array from the store.

#### Presentations Table
Same column structure as Dashboard recent table, but showing ALL presentations (paginated 10/page).

Columns: checkbox (bulk select), `#`, Title, Topics count, Slides, Theme (badge), Tone (badge-muted), Status (badge), Created (mono), Actions (download + delete)

**Bulk actions bar** (appears above table when ≥1 row checked): "N selected" label + "Download Selected" ghost btn + "Delete Selected" red ghost btn.

**Pagination:** footer with "Showing X–Y of Z records" + page buttons.

---

### 4. SettingsView (`/app/settings`)

**Page header:** `Settings` icon + title "Settings"

#### Tab bar (horizontal tabs, underline style):
- General
- AI Models
- API Keys
- Appearance

**Tab: General**
Settings cards with toggle rows:

| Setting | Toggle | Description |
|---------|--------|-------------|
| Auto-save presentations | on | Automatically save to history |
| Email notifications | off | Get notified on completion |
| High-quality images | on | Use premium image sources |
| Compression | off | Reduce file size on export |

Below toggles: "Default Slides" number input (2–15), "Default Tone" select dropdown.

**Tab: AI Models**
Per-model config rows showing:
- Model name + provider badge
- Max tokens input
- Temperature slider (0.0–1.0 with 0.1 steps, shows decimal value)
- Enable/disable toggle

Models to show: `Groq / Llama 3.3 70B`, `NVIDIA NIM / Llama 3.1 70B`

**Tab: API Keys**
- Each API key row: provider name + masked value input (`●●●●●●●●●●●●`) + `Eye` toggle to reveal + `Copy` icon button
- Providers: Groq API, NVIDIA NIM API, Freepik API, Unsplash API
- "Test Connection" ghost button per row — shows green `● Connected` or red `● Failed` badge after click

**Tab: Appearance**
- Theme selection (same 4 theme cards from Create view)
- Color accent selector (3 pre-set swatches: Blue `#0325BD`, Purple `#7C3AED`, Teal `#0891B2`)
- Font size: Small / Medium / Large depth-pill selector

**Save button:** "Save Settings" primary button at bottom of each tab. Calls `PUT /admin/settings` for admin, `PUT /settings` for employees.

---

### 5. AdminView (`/app/admin`) — Admin role only

**Page header:** `Shield` icon + title "Admin" + role badge `badge-red` "Administrator"

#### Sub-tab bar: Users · System · Logs · Rate Limits

**Tab: Users**
Full user table pulled from `GET /admin/users`:
Columns: Avatar (initials circle), Name, Employee ID (mono), Role (badge-blue for employee, badge-red for admin), Department, Created date, Status (badge-green Active / badge-red Inactive), Actions

Actions per row:
- Role toggle button (promote to admin / demote to employee)
- Disable/Enable account toggle

Footer: total user count + pagination.

**Tab: System**
4 KPI cards: Total Presentations, Active Users, Uptime, API Calls Today
System status rows: each service (MongoDB, Groq API, NVIDIA API, Freepik API, Redis) with colored dot status + last-checked timestamp + "Ping" button.

**Tab: Logs**
Log table: Timestamp (mono), Level (badge: INFO=blue, WARN=yellow, ERROR=red), Service, Message
Auto-refresh toggle + "Export Logs" ghost button.
Filter by level dropdown.

**Tab: Rate Limits**
Table of endpoint → current limit → edit input → save button per row.
Endpoints: `/generate`, `/download`, `/delete`, global.

---

## SHARED COMPONENTS

Build these as reusable components in `src/components/`:

### `ToastContainer.tsx`
- Fixed `top: 62px, right: 20px`, z-index 300
- Slide-in animation from right (`slideIn` keyframe)
- Each toast: left 3px color bar (green=success, red=error) + icon + message
- Auto-dismiss after 4000ms
- Expose via `useToast()` hook: `{ showToast(message, type) }`

### `Badge.tsx`
Props: `variant: 'green'|'blue'|'yellow'|'red'|'purple'|'muted'`, `dot?: boolean`, `children`

### `KpiCard.tsx`
Props: `label`, `value`, `suffix?`, `icon`, `iconVariant: 'blue'|'green'|'purple'|'yellow'`, `delta?`
Uses mono font for numeric values.

### `DataTable.tsx`
Props: `columns`, `data`, `pagination?`, `onRowSelect?`, `loading?`
Implements the full table pattern from HTML including hover state, footer, and pagination controls.

### `TagInput.tsx`
Controlled component. Props: `tags: string[]`, `onChange(tags)`, `placeholder`, `max`
- Enter or comma adds a tag
- Backspace on empty input removes last tag
- Tags render as styled chips with ✕ button

### `ProgressOverlay.tsx`
Driven by `usePresentationStore.generationProgress`: `{ step: number, percent: number, label: string }`
Shows/hides based on `isGenerating` flag in store.

### `SearchableDropdown.tsx`
Implements the `sd-wrap / sd-panel / sd-search-inp / sd-list / sd-opt` pattern from the HTML exactly.
Props: `label`, `value`, `options: {value, label}[]`, `onChange`, `placeholder?`

---

## STATE MANAGEMENT

### `useAuthStore` (keep existing — do not modify logic)
```typescript
{
  user: { id, name, employee_id, role, department } | null,
  token: string | null,
  isAuthenticated: boolean,
  login(credentials) → Promise<void>,
  logout() → void,
}
```

### `useAppStore` (keep existing — do not modify logic)
```typescript
{
  currentPage: string,
  sidebarCollapsed: boolean,
  setCurrentPage(page: string) → void,
}
```

### `usePresentationStore` (keep existing — do not modify logic)
```typescript
{
  presentations: Presentation[],
  isGenerating: boolean,
  generationProgress: { step: number, percent: number, label: string },
  fetchPresentations() → Promise<void>,
  generatePresentation(params) → Promise<void>,
  downloadPresentation(id) → Promise<void>,
  deletePresentation(id) → Promise<void>,
  resetCreation() → void,
}
```

---

## API INTEGRATION

All API calls go through `src/api/client.ts` (Axios instance with `baseURL = import.meta.env.VITE_API_URL`, Authorization Bearer token injected via request interceptor).

**Endpoints used:**

| Method | Path | Used in |
|--------|------|---------|
| POST | `/auth/login` | AuthView (do not touch) |
| GET | `/presentations` | Dashboard, History |
| POST | `/generate` | CreateView (PPT tab) |
| GET | `/presentations/:id/download` | Anywhere download is triggered |
| DELETE | `/presentations/:id` | Dashboard, History |
| GET | `/admin/users` | AdminView |
| GET | `/admin/settings` | SettingsView (admin) |
| PUT | `/admin/settings` | SettingsView (admin) |
| GET | `/admin/logs` | AdminView Logs tab |
| GET | `/system/status` | AdminView System tab |

---

## FUNCTIONALITY REQUIREMENTS

Every piece of existing functionality must be preserved:

1. **Login / Auth** — untouched. `AuthView.tsx` is out of scope.
2. **JWT persistence** — token in `localStorage`, injected on every request.
3. **Role-based routing** — `/app/admin` only for `role === 'admin'`. Admin nav item only shown for admin users.
4. **Presentation generation** — full progress overlay with animated steps. Real API call on step 1 (WRITING_CONTENT). Steps 3–4 are theatrical delay — keep as-is.
5. **Download** — triggers file download via `Content-Disposition` attachment response, uses `URL.createObjectURL`.
6. **Delete** — inline confirmation (change button to "Confirm?" with 3s timeout before it fires), then `DELETE` request, remove from store.
7. **History filters** — all three filters (search, status, date) must be wired and functional. This is a known bug in the old code — fix it here.
8. **Admin settings** — admin can update model toggles, rate limits, etc.
9. **Toast notifications** — success/error after every async operation.
10. **Error boundaries** — wrap the entire `AppShell` in an `ErrorBoundary` component. Show a styled fallback card (matching design) with "Something went wrong" + "Reload" button.

---

## KNOWN BUGS TO FIX IN THIS REBUILD

Fix these during the rebuild — do not carry them over:

| Bug | Fix |
|-----|-----|
| `navigate('/dashboard')` in PreviewView after download | Change to `navigate('/app/dashboard')` |
| Filter dropdowns in HistoryView have no `onChange` | Wire all 3 filters properly |
| `include_images` missing from API payload | Always include `include_images: true` in POST `/generate` |
| Signup form visible in AuthView | Do not expose signup in any authenticated view |
| `handleDownload` duplicated across views | Use shared `useDownload()` hook from `usePresentationStore` |

---

## FILE / FOLDER STRUCTURE

```
src/
├── api/
│   └── client.ts               # Axios instance
├── components/
│   ├── AppShell.tsx             # Layout wrapper (sidebar + topbar + statusbar + outlet)
│   ├── AppSidebar.tsx
│   ├── AppTopbar.tsx
│   ├── AppStatusBar.tsx
│   ├── Badge.tsx
│   ├── DataTable.tsx
│   ├── ErrorBoundary.tsx
│   ├── KpiCard.tsx
│   ├── ProgressOverlay.tsx
│   ├── SearchableDropdown.tsx
│   ├── TagInput.tsx
│   └── ToastContainer.tsx
├── hooks/
│   ├── useDownload.ts
│   └── useToast.ts
├── store/
│   ├── useAuthStore.ts          # DO NOT MODIFY logic
│   ├── useAppStore.ts           # DO NOT MODIFY logic
│   └── usePresentationStore.ts  # DO NOT MODIFY logic
├── styles/
│   └── tokens.css               # All CSS custom properties
├── views/
│   ├── AuthView.tsx             # DO NOT MODIFY
│   ├── DashboardView.tsx
│   ├── CreateView.tsx
│   ├── HistoryView.tsx
│   ├── SettingsView.tsx
│   └── AdminView.tsx
├── router.tsx                   # createBrowserRouter config
└── main.tsx
```

---

## QUALITY CONSTRAINTS

- **TypeScript strict:** No `any` types. All props typed. All API responses typed.
- **No inline styles:** Use CSS custom properties + Tailwind utilities only. No `style={{}}` except for dynamic values (e.g., progress bar width).
- **Accessible:** All buttons have `aria-label`. Form inputs have `htmlFor` labels. Interactive elements have focus rings.
- **No hardcoded colors:** Every color must reference a CSS variable.
- **Responsive:** The design is desktop-first (min 1280px). Do not break layout below that width; simply allow horizontal scroll.
- **Animations:** Preserve all keyframe animations from the HTML (`logo-pulse`, `blink`, `fadeUp`, `shimmer`, `bounce`, `btn-pulse`, `spinning`, `slideIn`, `skeleton-pulse`). Define them in `tokens.css`.

---

## WHAT NOT TO DO

- ❌ Do not change `AuthView.tsx` or its logic
- ❌ Do not change the API client base URL or auth interceptor
- ❌ Do not change store logic (only update UI wiring)
- ❌ Do not introduce new npm packages not already in `package.json` (except Lucide React if not present)
- ❌ Do not use any other icon library than **Lucide React**
- ❌ Do not use ShadCN, Radix, or any component library — all UI is custom per the HTML design
- ❌ Do not use light mode — the app is dark mode only
- ❌ Do not add a signup flow anywhere in the authenticated shell

---

## DELIVERABLE

A complete, working React TypeScript frontend that:
1. Exactly matches the visual design in `ppt-generator-v3_1.html`
2. Has all 5 views fully wired to the backend API
3. Has all 3 Zustand stores working
4. Has no TypeScript errors (`tsc --noEmit` must pass)
5. Runs with `npm run dev` and builds with `npm run build` without errors
