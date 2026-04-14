# Skynet PPT Generator — Timesheet Design Integration
**Reference:** CTO Directive — "Same palette and design language as the Timesheet application. Add it as a new route."
**Date:** 2026-04-14
**Status:** Ready for Implementation

---

## 1. WHAT THE TIMESHEET APP ACTUALLY LOOKS LIKE (Token Extraction)

Based on pixel analysis of the 3 provided screenshots:

### 1.1 Color Tokens

| Token Name | Hex Value | Usage |
|---|---|---|
| `--ts-bg-base` | `#0A0C12` | Page/body background |
| `--ts-bg-surface` | `#0F1118` | Card/panel background |
| `--ts-bg-surface-2` | `#13161F` | Nested card, input background |
| `--ts-bg-header` | `#0D0F17` | Top header bar background |
| `--ts-bg-sidebar` | `#0B0D14` | Left sidebar background |
| `--ts-border` | `rgba(255,255,255,0.06)` | Card borders, dividers |
| `--ts-border-strong` | `rgba(255,255,255,0.10)` | Focused inputs, active states |
| `--ts-emp-primary` | `#2563EB` | Employee mode — blue accent (buttons, active nav) |
| `--ts-emp-primary-glow` | `rgba(37,99,235,0.20)` | Blue glow behind buttons |
| `--ts-emp-primary-muted` | `rgba(37,99,235,0.12)` | Blue tint on card backgrounds |
| `--ts-adm-primary` | `#DC2626` | Admin mode — red accent (buttons, active nav) |
| `--ts-adm-primary-glow` | `rgba(220,38,38,0.20)` | Red glow |
| `--ts-adm-primary-muted` | `rgba(220,38,38,0.10)` | Red tint |
| `--ts-success` | `#16A34A` | Success states, active badges |
| `--ts-success-muted` | `rgba(22,163,74,0.12)` | Success badge background |
| `--ts-warning` | `#CA8A04` | Warning states |
| `--ts-text-primary` | `#F1F5F9` | Headings, main content |
| `--ts-text-secondary` | `#94A3B8` | Labels, subtext |
| `--ts-text-muted` | `#475569` | Placeholders, disabled text |
| `--ts-text-accent-emp` | `#60A5FA` | Blue-tinted numbers/values (employee) |
| `--ts-text-accent-adm` | `#F87171` | Red-tinted numbers/values (admin) |

### 1.2 Typography

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Page Title | `Inter` | 700 | `20px` | `-0.02em` |
| Card Title | `Inter` | 600 | `14px` | `normal` |
| Section Label | `Inter` | 700 | `11px` | `0.08em` uppercase |
| Body Text | `Inter` | 400 | `13px` | `normal` |
| Monospace Labels | `Share Tech Mono` | 400 | `10-11px` | `0.1em` uppercase |
| Stat Numbers | `Inter` | 700 | `28-32px` | `-0.03em` |
| Badge Text | `Share Tech Mono` | 700 | `9-10px` | `0.12em` uppercase |

> **Key change from current Skynet:** Drop `Orbitron` as the heading font entirely. The Timesheet app uses `Inter` for all headings. `Share Tech Mono` is retained but only for labels/monospace text — not headings.

### 1.3 Layout Shell Dimensions

| Element | Value |
|---|---|
| Header height | `52px` |
| Sidebar width (expanded) | `52px` (icon-only — no expand) |
| Status bar height | `28px` |
| Card border-radius | `12px` |
| Button border-radius | `8px` |
| Input border-radius | `8px` |
| Content padding | `24px 28px` |

### 1.4 Component Patterns (From Screenshots)

**Header:**
- Left: App logo (lightning bolt icon in yellow `#FBBF24` on dark background) + "Timesheet Application" title + "Q LABS TRAINING TEAM" subtitle in muted text
- Right: User full name + Employee ID + role tag + avatar initials pill
- Background: `#0D0F17`, bottom border `rgba(255,255,255,0.06)`
- No toggle button — sidebar is always icon-only

**Sidebar:**
- Width: `~52px`, always icon-only
- Background: `#0B0D14`, right border `rgba(255,255,255,0.06)`
- Nav icons: 40×40px buttons, centered
- Active icon: colored (blue for most, specific colors per module)
- Bottom: dark/light mode toggle + settings icon + power/logout icon
- Active item has NO background fill — only the icon itself is colored

**Cards:**
- Background: `#0F1118`
- Border: `1px solid rgba(255,255,255,0.06)`
- Border-radius: `12px`
- Box-shadow: `0 4px 24px rgba(0,0,0,0.4)`
- No scanlines, no corner brackets, no glow effects on cards

**Stat Cards (Dashboard):**
- Label: `Inter` 10px uppercase muted
- Value: large number in `--ts-text-accent-emp` color (blue) or standard white
- Sub-label: small muted text
- Top-right icon in circle container

**Status Badges:**
```
COMPLETED  → bg: rgba(22,163,74,0.12)   text: #4ADE80  border: rgba(22,163,74,0.20)
PENDING    → bg: rgba(37,99,235,0.12)   text: #60A5FA  border: rgba(37,99,235,0.20)
FAILED     → bg: rgba(220,38,38,0.12)   text: #F87171  border: rgba(220,38,38,0.20)
```

**Inputs:**
- Background: `#13161F`
- Border: `1px solid rgba(255,255,255,0.06)`
- Focus border: `1px solid rgba(37,99,235,0.50)`
- Placeholder: `#475569`
- Left icon: `#64748B` muted

**Primary Buttons:**
- Employee: `bg-[#2563EB]` hover `bg-[#1D4ED8]`, `shadow: 0 0 20px rgba(37,99,235,0.30)`
- Admin: `bg-[#DC2626]` hover `bg-[#B91C1C]`, `shadow: 0 0 20px rgba(220,38,38,0.30)`
- Text: white, `Inter` 700, `tracking-widest`, uppercase

**Bottom Status Bar:**
```
[ SERVER: ONLINE ] [ • TLS 1.3 · ENCRYPTED ] [ UTC: HH:MM:SS | IST: HH:MM:SS ] [ ☀ LIGHT ] [ v2.4.1 · SWIFT OPS ]
```
All in `Share Tech Mono` 9px, `#64748B` color, spaced with `|` dividers

### 1.5 Background Animations (Login Page)

| Mode | Animation | Colors |
|---|---|---|
| Employee | Wireframe 3D sphere (rotating, line mesh) | Blue `#2563EB`, line opacity `0.3` |
| Admin | Particle network (dots + connecting lines) | Green `#16A34A`, line opacity `0.25` |

> Note: Dashboard background is clean — **no animated background inside the app shell**. Animations are login-page only.

---

## 2. CURRENT SKYNET vs TIMESHEET — DIFF TABLE

| Element | Current Skynet | Timesheet Target | Action |
|---|---|---|---|
| Body bg | `#020408` | `#0A0C12` | Replace |
| Card bg | `#0B0F19` | `#0F1118` | Replace |
| Input bg | `#111624` | `#13161F` | Replace |
| Emp accent | `#3D5AFE` | `#2563EB` | Replace |
| Adm accent | `#D32F2F` | `#DC2626` | Replace |
| Success | `#00E5A0` | `#16A34A` / `#4ADE80` | Replace |
| Heading font | `Orbitron` | `Inter` 700 | Replace |
| Label font | `Share Tech Mono` | `Share Tech Mono` | Keep |
| Body font | `Rajdhani` / `Inter` | `Inter` | Keep Inter, drop Rajdhani |
| Card radius | `16-24px` | `12px` | Reduce |
| Button radius | `12px` | `8px` | Reduce |
| Scan lines | Yes (`index.css`) | No | Remove |
| Particle bg (app shell) | Yes (ThreeBackground) | No | Remove from shell |
| Status bar | Dark, cyan accents | Dark, gray text | Update colors |
| Sidebar expand toggle | Yes | No | Remove toggle |
| Header logo | "S" gradient square | Lightning icon + text | Update |
| Corner brackets | Yes (CSS classes) | No | Remove |

---

## 3. FILE-BY-FILE CHANGES

### 3.1 `frontend/src/index.css` — Full Token Replacement

**Remove / Replace everything in the `:root` block and `@theme` block.**

Replace with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap');
@import "tailwindcss";

@theme {
  /* ── Base Surfaces ─────────────────────────── */
  --color-bg-base:        #0A0C12;
  --color-bg-surface:     #0F1118;
  --color-bg-surface-2:   #13161F;
  --color-bg-header:      #0D0F17;
  --color-bg-sidebar:     #0B0D14;

  /* ── Borders ───────────────────────────────── */
  --color-border:         rgba(255,255,255,0.06);
  --color-border-strong:  rgba(255,255,255,0.10);

  /* ── Employee Accent (Blue) ────────────────── */
  --color-emp:            #2563EB;
  --color-emp-hover:      #1D4ED8;
  --color-emp-glow:       rgba(37,99,235,0.20);
  --color-emp-muted:      rgba(37,99,235,0.12);
  --color-emp-text:       #60A5FA;

  /* ── Admin Accent (Red) ────────────────────── */
  --color-adm:            #DC2626;
  --color-adm-hover:      #B91C1C;
  --color-adm-glow:       rgba(220,38,38,0.20);
  --color-adm-muted:      rgba(220,38,38,0.10);
  --color-adm-text:       #F87171;

  /* ── Semantic ──────────────────────────────── */
  --color-success:        #16A34A;
  --color-success-text:   #4ADE80;
  --color-success-muted:  rgba(22,163,74,0.12);
  --color-warning:        #CA8A04;
  --color-warning-text:   #FCD34D;

  /* ── Text ──────────────────────────────────── */
  --color-text-primary:   #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-text-muted:     #475569;

  /* ── Typography ────────────────────────────── */
  --font-body:     "Inter", sans-serif;
  --font-mono:     "Share Tech Mono", monospace;

  /* ── Dimensions ────────────────────────────── */
  --header-h:     52px;
  --sidebar-w:    52px;
  --statusbar-h:  28px;
  --radius-card:  12px;
  --radius-btn:   8px;
  --radius-input: 8px;
}

html, body {
  scroll-behavior: smooth;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: var(--font-body);
}
```

**Also remove from `index.css`:**
- All `.corner-bracket-*` classes
- All `.sbm`, `.scl` (scanline/beam) animations
- All `--cy`, `--am`, `--rd`, `--gn` token references
- `.sbar` class — rebuild with new tokens

### 3.2 `frontend/src/components/layout/MainLayout.tsx`

**Changes:**
1. Remove `ThreeBackground` component import and usage entirely (no animated bg in app shell)
2. Update header logo from "S" gradient square → lightning bolt icon (or keep "S" but restyle)
3. Remove sidebar collapse toggle button
4. Update `--sw` / `--sw-c` CSS variable usage — sidebar is always `52px` fixed
5. Update header title: `"SKYNET"` → `"PPT Generator"` with `"Q LABS"` subtitle underneath

```tsx
// Header logo area — replace current .lc/.ln block with:
<div className="flex items-center gap-3 px-4">
  <div className="w-9 h-9 rounded-xl bg-[#1E293B] border border-white/10 flex items-center justify-center">
    <span className="material-symbols-outlined text-[#FBBF24] text-[20px]">bolt</span>
  </div>
  <div className="flex flex-col">
    <span className="text-[13px] font-bold text-white tracking-tight">PPT Generator</span>
    <span className="text-[9px] font-mono text-[#475569] tracking-widest uppercase">Q LABS · SWIFT OPS</span>
  </div>
</div>
```

### 3.3 `frontend/src/components/layout/Sidebar.tsx`

**Changes:**
1. Remove expand/collapse logic — always icon-only `52px`
2. Remove `sidebarCollapsed` state usage
3. Remove `.ndv` dividers between nav groups
4. Update active state: remove background fill, only icon color changes
5. Update active icon color to `--color-emp` (`#2563EB`)

```tsx
// Nav item class — replace current:
`ni ${isActive ? 'act' : ''}`

// With Tailwind-based:
`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
 ${isActive
   ? 'text-[#2563EB]'
   : 'text-[#475569] hover:text-[#94A3B8] hover:bg-white/5'
 }`
```

### 3.4 `frontend/src/views/DashboardView.tsx`

**Changes:**
1. Replace all `bg-[#0B0F19]` → `bg-[#0F1118]`
2. Replace all `bg-[#111624]` → `bg-[#13161F]`
3. Replace `text-blue-500` → `text-[#2563EB]`
4. Replace `bg-blue-600 hover:bg-blue-500` → `bg-[#2563EB] hover:bg-[#1D4ED8]`
5. Replace `rounded-2xl` → `rounded-xl` on all cards
6. Remove `shadow-[0_8px_32px_rgba(0,0,0,0.5)]` → use `shadow-[0_4px_24px_rgba(0,0,0,0.4)]`
7. Replace `text-[10px]` label uppercase headings: keep tracking-widest but switch to Inter (it already is)

### 3.5 `frontend/src/views/CreatorView.tsx`

**Changes:**
1. Same hex replacement as DashboardView
2. Tone pill active state: replace `bg-purple-500` → `bg-[#2563EB]` (use blue, not purple, to match Timesheet)
3. Theme button active state: replace `bg-emerald-500/10 text-emerald-400 border-emerald-500/20` → `bg-[#2563EB]/10 text-[#60A5FA] border-[#2563EB]/20`
4. Provider card active state: already `bg-blue-600/10 border-blue-500/30 text-blue-400` → update to exact tokens

### 3.6 `frontend/src/views/HistoryView.tsx`

**Changes:**
1. Hex replacement (same as above)
2. Fix: Wire the two `<select>` filter dropdowns to actual `onChange` handlers (currently non-functional)
3. Add `STATUS` filter: filter `filteredPresentations` by status value
4. Add `RANGE` filter: filter by `created_at` relative to today

### 3.7 `frontend/src/views/AdminView.tsx`

**Changes:**
1. Hex replacement
2. Active tab indicator: change from blue underline → `bg-[#DC2626]` (admin mode = red accent)
3. Admin-specific: update all `bg-blue-*` accent classes to `bg-[#DC2626]` / `text-[#F87171]`

### 3.8 `frontend/src/components/Login.tsx`

**Changes (mostly already correct — smallest delta):**
1. Card background: already `bg-[#0B0F19]/95` → update to `bg-[#0F1118]/95`
2. Emp accent: `text-primary` → `text-[#2563EB]` (currently `#3D5AFE`, needs update)
3. Admin accent: already using `text-red-500` → update to `text-[#DC2626]`
4. Button: already correct pattern
5. Background animation: already correct (sphere for employee, particle network for admin)
6. **Remove Signup mode** — delete `<Signup />` component and mode toggle

### 3.9 `frontend/src/views/AuthView.tsx`

**Changes:**
1. Remove `{mode === 'signup' ? <Signup />}` block
2. Remove `onSwitchToSignup` prop entirely
3. Remove the `<Signup />` import and `mode` state
4. Update grid background CSS from `#3d5afe15` → `#2563eb15`
5. Replace purple orb `bg-tertiary/5` → `bg-[#2563EB]/5`
6. Update logo area: match Timesheet header format

### 3.10 `backend/routers/auth.py` — Critical Fix

**Remove hardcoded backdoor immediately:**

```python
# DELETE THIS BLOCK:
if employee_id == "Admin_Skynet" and credentials.password == "admin@skynet":
    ...

# REPLACE WITH: admin user should exist in the Timesheet DB
# If you need a master admin, seed it properly via a DB init script
```

---

## 4. NEW COMPONENT: `StatusBar.tsx`

Extract status bar into its own component that matches Timesheet exactly:

```tsx
// frontend/src/components/layout/StatusBar.tsx
export default function StatusBar({ mode = 'employee' }: { mode?: 'employee' | 'admin' }) {
  const { timeStr } = useAppStore();
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[28px] bg-[#0D0F17] border-t border-white/[0.06] flex items-center justify-between px-5 z-50">
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#475569] tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse"></span>
          SERVER: ONLINE
        </span>
        <span className="font-mono text-[9px] text-[#475569] tracking-widest hidden sm:block">
          TLS 1.3 · ENCRYPTED
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="font-mono text-[9px] text-[#475569] tracking-widest">{timeStr}</span>
        <span className="font-mono text-[9px] text-[#475569] tracking-widest border-l border-white/[0.06] pl-4">
          v2.4.1 · SWIFT OPS
        </span>
      </div>
    </footer>
  );
}
```

---

## 5. CSS CLASSES TO FIND & REPLACE (Global Search)

Run these find-and-replace operations across all `.tsx` and `.css` files:

| Find | Replace | Notes |
|---|---|---|
| `bg-\[#0B0F19\]` | `bg-[#0F1118]` | Card background |
| `bg-\[#111624\]` | `bg-[#13161F]` | Input background |
| `bg-\[#020408\]` | `bg-[#0A0C12]` | Page background |
| `bg-\[#06080F\]` | `bg-[#0A0C12]` | Page background alt |
| `bg-blue-600` | `bg-[#2563EB]` | Primary button |
| `hover:bg-blue-500` | `hover:bg-[#1D4ED8]` | Primary button hover |
| `text-blue-500` | `text-[#2563EB]` | Icon accent |
| `text-blue-400` | `text-[#60A5FA]` | Text accent |
| `border-blue-500` | `border-[#2563EB]` | Focus border |
| `text-emerald-400` | `text-[#4ADE80]` | Success text |
| `bg-emerald-500/10` | `bg-[#16A34A]/10` | Success bg |
| `text-red-500` | `text-[#DC2626]` | Admin accent |
| `rounded-2xl` | `rounded-xl` | Card radius reduction |
| `font-\[\'Orbitron\'\]` | `font-sans font-bold` | Drop Orbitron |
| `#00f0ff` | `#2563EB` | Old cyan → new blue |
| `#00FF41` | `#4ADE80` | Old neon green → standard green |

---

## 6. WHAT TO KEEP UNCHANGED

These elements already match or are intentionally kept:

- ✅ `Share Tech Mono` — used identically in Timesheet
- ✅ Terminal label voice (`SESSION_INIT`, `AWAITING_CREDENTIALS`, `ADMIN_OVERRIDE`) — Timesheet uses the same
- ✅ Employee / Admin tab switcher on login — identical pattern
- ✅ Status bar at bottom — same layout, just update colors
- ✅ `EMPLOYEE_ID` / `MANAGER_ID` input labels — exact match
- ✅ Background animations on login (sphere + particle network) — identical to Timesheet
- ✅ `AUTHENTICATE` button label — exact match
- ✅ `"Are you an admin? Admin Login →"` switcher link — exact match
- ✅ `"Powered by Neo Q Labs"` footer — keep
- ✅ Zustand stores — no changes needed
- ✅ FastAPI backend routers — no changes (except remove hardcoded admin bypass)
- ✅ JWT auth flow — no changes
- ✅ Dual DB connection (skynet_db + Timesheet-Application) — no changes

---

## 7. INTEGRATION AS TIMESHEET ROUTE

When the Timesheet frontend codebase is available, add Skynet as follows:

### 7.1 Route Registration (in Timesheet `App.tsx`)

```tsx
// Lazy-load Skynet views
const PPTDashboard  = lazy(() => import('./views/skynet/DashboardView'));
const PPTCreator    = lazy(() => import('./views/skynet/CreatorView'));
const PPTPreview    = lazy(() => import('./views/skynet/PreviewView'));
const PPTHistory    = lazy(() => import('./views/skynet/HistoryView'));
const PPTAdmin      = lazy(() => import('./views/skynet/AdminView'));
const PPTSettings   = lazy(() => import('./views/skynet/SettingsView'));

// Inside protected route wrapper:
<Route path="/ppt-generator"         element={<PPTDashboard />} />
<Route path="/ppt-generator/create"  element={<PPTCreator />} />
<Route path="/ppt-generator/preview" element={<PPTPreview />} />
<Route path="/ppt-generator/history" element={<PPTHistory />} />
<Route path="/ppt-generator/settings" element={<PPTSettings />} />
<Route element={<AdminRoute />}>
  <Route path="/ppt-generator/admin" element={<PPTAdmin />} />
</Route>
```

### 7.2 Sidebar Entry (in Timesheet `Sidebar.tsx`)

Add under a "Tools" section divider:

```tsx
<div className="mt-auto">
  <div className="text-[9px] font-mono text-[#475569] tracking-widest px-3 mb-2 uppercase">Tools</div>
  <NavLink to="/ppt-generator" className={({ isActive }) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-colors mx-auto mb-1
     ${isActive ? 'text-[#2563EB]' : 'text-[#475569] hover:text-[#94A3B8] hover:bg-white/5'}`
  }>
    <span className="material-symbols-outlined text-[20px]">slideshow</span>
  </NavLink>
</div>
```

### 7.3 Auth Token Bridge

The Timesheet app issues its own JWT. Skynet's backend needs to accept it.

**Option A (Preferred — same secret):** If `JWT_SECRET` is the same in both apps, Skynet backend reads the Timesheet JWT directly. No code changes needed on backend.

**Option B (Different secrets):** Add exchange endpoint to Skynet backend:
```python
@router.post("/auth/exchange")
async def exchange_token(request: Request):
    """Accept a Timesheet JWT, verify user in Timesheet DB, issue a Skynet JWT."""
    timesheet_token = request.headers.get("X-Timesheet-Token")
    # verify it against Timesheet DB, issue Skynet-scoped JWT
    ...
```

### 7.4 Environment Variable

Add to Timesheet frontend `.env`:
```env
VITE_SKYNET_API_BASE=https://your-skynet-backend-url.com
```

All Skynet views use `VITE_API_BASE` — rename to `VITE_SKYNET_API_BASE` to avoid collision with Timesheet's own API base.

---

## 8. PRIORITY ORDER FOR IMPLEMENTATION

### Phase 0 — Pre-work (Day 1 morning, 2 hours)
- [ ] Remove `Admin_Skynet` hardcoded backdoor from `auth.py`
- [ ] Fix `sanitize_filename` import in `generation_service.py`
- [ ] Add `include_images` field to `PresentationRequest` Pydantic model
- [ ] Remove `Signup` component and mode from `AuthView.tsx`

### Phase 1 — Token Swap (Day 1 afternoon, 4 hours)
- [ ] Replace `index.css` `:root` and `@theme` blocks with new tokens
- [ ] Run global find-and-replace on all hex values (table in Section 5)
- [ ] Remove Orbitron font from Google Fonts import
- [ ] Remove `Rajdhani` font from import
- [ ] Remove scan lines and beam animations from CSS

### Phase 2 — Shell Updates (Day 2, 4 hours)
- [ ] Update `MainLayout.tsx` — remove ThreeBackground, update header
- [ ] Update `Sidebar.tsx` — remove collapse toggle, update active states
- [ ] Create new `StatusBar.tsx` component
- [ ] Update `Login.tsx` — hex values, remove signup link

### Phase 3 — View Updates (Day 2–3, 6 hours)
- [ ] `DashboardView.tsx` — radius + color updates
- [ ] `CreatorView.tsx` — tone/theme pill + radius updates
- [ ] `HistoryView.tsx` — wire filter dropdowns + color updates
- [ ] `AdminView.tsx` — red admin accent, typing improvements

### Phase 4 — Route Integration (Day 3, 2 hours)
- [ ] Copy Skynet view files into Timesheet `src/views/skynet/` directory
- [ ] Register routes in Timesheet `App.tsx`
- [ ] Add sidebar entry in Timesheet `Sidebar.tsx`
- [ ] Test auth token compatibility

### Phase 5 — QA (Day 4, 2 hours)
- [ ] Visual regression — compare every screen against Timesheet screenshots
- [ ] Auth flow: employee login → PPT dashboard → generate → download
- [ ] Admin flow: admin login → admin panel → user list
- [ ] Mobile layout check (responsive breakpoints)

---

## 9. QUICK REFERENCE — SIDE BY SIDE

```
TIMESHEET (TARGET)              SKYNET (CURRENT → AFTER)
─────────────────────────────   ──────────────────────────────
bg: #0A0C12                 →   bg: #020408     → #0A0C12
card: #0F1118               →   card: #0B0F19   → #0F1118
input: #13161F              →   input: #111624  → #13161F
emp blue: #2563EB           →   emp: #3D5AFE    → #2563EB
adm red: #DC2626            →   adm: #D32F2F    → #DC2626
font: Inter 700 headings    →   Orbitron        → Inter 700
font: Share Tech Mono       →   Share Tech Mono → (keep)
radius: 12px cards          →   16-24px         → 12px
sidebar: 52px fixed         →   62px collapsible → 52px fixed
no bg animation in shell    →   ThreeBackground  → remove
```

---

*Document maintained by: Skynet Integration Team*
*Last updated: 2026-04-14*
