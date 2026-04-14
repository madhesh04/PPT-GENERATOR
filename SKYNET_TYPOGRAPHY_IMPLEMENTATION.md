# Skynet PPT Generator — Typography Implementation Guide
**Source:** `Skynet_Typography_System.docx` — Complete Type Specification · Swift Ops Timesheet  
**Extracted from:** Timesheet Application Frontend · Reference for Skynet Integration  
**Date:** April 2026  
**Status:** Ready for Implementation

---

## 0. THE ONE-LINE SUMMARY

> **Replace Orbitron + Rajdhani → Nunito. Replace Share Tech Mono → JetBrains Mono. That's the entire font migration.**

---

## 1. FONT FAMILIES — WHAT CHANGES

### 1.1 Current Skynet Fonts (To Remove)

| Font | Current Role | Status |
|---|---|---|
| `Orbitron` | Headings, labels, nav items, buttons | ❌ **Remove entirely** |
| `Rajdhani` | Body copy, fallback UI | ❌ **Remove entirely** |
| `Share Tech Mono` | Monospace labels, status bar, tags | ❌ **Replace** |
| `Inter` | Secondary body (partial use) | ⚠️ **Phase out — Nunito takes over** |

### 1.2 Target Timesheet Fonts (To Add)

| Font | Role | CSS Constant | Weights to Load |
|---|---|---|---|
| **Nunito** | Primary UI — ALL headings, labels, buttons, body, nav | `fontStack` | 300, 400, 500, 600, 700, 800, 900 |
| **JetBrains Mono** | Data/numbers/IDs/dates/code/chart axes | `monoStack` | 400, 500, 600, 700 |
| **Material Symbols Outlined** | UI icons (login page, settings) | — | Variable (FILL 0–1) |
| **Heroicons v2** | Primary icon library | `@heroicons/react` | NPM package |

### 1.3 Google Fonts Import — Replace in `index.css`

**Remove:**
```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;800;900&family=Inter:wght@300;400;500;600;700&family=Share+Tech+Mono&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
```

**Add:**
```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

---

## 2. CSS VARIABLES — REPLACE IN `index.css`

### 2.1 Remove Old Font Tokens

Find and delete these lines from `index.css` (`@theme` block and `:root` block):
```css
/* DELETE ALL OF THESE */
--font-headline: "Orbitron", sans-serif;
--font-body: "Inter", sans-serif;
--font-label: "Share Tech Mono", monospace;
--fd: 'Orbitron', monospace;
--fm: 'Share Tech Mono', monospace;
--fb: 'Rajdhani', sans-serif;
```

### 2.2 Add New Font Tokens

Add these to the `@theme` block in `index.css`:
```css
/* ── Typography ─────────────────────────────── */
--font:  'Nunito', 'DM Sans', sans-serif;
--mono:  'JetBrains Mono', 'DM Mono', monospace;

/* Tailwind @theme aliases */
--font-body:  'Nunito', 'DM Sans', sans-serif;
--font-mono:  'JetBrains Mono', 'DM Mono', monospace;
```

### 2.3 Update `body` Rule in `index.css`

```css
/* BEFORE */
body {
  font-family: var(--fb);   /* Rajdhani */
}

/* AFTER */
body {
  font-family: var(--font);  /* Nunito */
  font-weight: 400;
}
```

### 2.4 JavaScript Constants — Add to Every Component That Renders Text

Copy these two constants into components that use inline `fontFamily` styles.  
**Never hardcode a font string — always use these variables.**

```typescript
// Add near the top of any component using inline font styles
const fontStack = "'Nunito', 'DM Sans', sans-serif";
const monoStack = "'JetBrains Mono', 'DM Mono', monospace";
```

Or export them from a shared tokens file:

```typescript
// frontend/src/lib/typography.ts  (create this file)
export const fontStack = "'Nunito', 'DM Sans', sans-serif";
export const monoStack = "'JetBrains Mono', 'DM Mono', monospace";
```

---

## 3. COMPLETE TYPE SCALE

All sizes are pixel-precise as used in the Timesheet source. Use these as the reference for every element in Skynet.

| Size | Tailwind Equiv | Weights Used | Font | Where Used in Skynet |
|---|---|---|---|---|
| **9px** | — | 600, 700, 800 | Nunito | Micro labels, status badge text, section divider labels, chart note text |
| **10px** | `text-xs` | 500, 700, 800 | Nunito | Section labels (UPPERCASE + `letterSpacing:1`), subtitle copy, employee ID rows, filter tab labels, footer text |
| **11px** | `text-xs` | 400, 500, 600, 700 | Nunito / Mono | Card subtitles, table secondary rows, stat sub-labels, timestamps, slide description text |
| **12px** | `text-sm` | 400, 600, 700, 800 | Nunito / Mono | Table header `<th>` labels (`letterSpacing:0.8`), chart legend labels, filter tab buttons, export buttons, pagination text, avatar initials |
| **13px** | `text-sm` | 400, 600, 700 | Nunito | Primary body copy, action buttons (Edit, Delete), input field text, empty state messages, loading states |
| **14px** | `text-sm` | 400, 600, 700, 800 | Nunito / Mono | Section header titles, primary table cell text (name, KRA) — **use monoStack for date/ID cells** |
| **15px** | `text-base` | 600, 800 | Nunito | App name in sidebar header (`fontStretch:'condensed'`, `letterSpacing:'-0.3px'`) |
| **16px** | `text-base` | 400 | Nunito | Base body size, login form inputs (prevents iOS zoom) |
| **18px** | `text-lg` | 700, 800 | Nunito | Page-level `h1` headings (Dashboard, History, etc.) |
| **20px** | `text-xl` | 700, 800 | Nunito | Modal/panel primary titles, major section headings |
| **22px** | `text-2xl` | 800 | Mono | Task completion percentage in donut ring |
| **24px** | `text-2xl` | 800 | **Mono** | Primary KPI metric numbers — `letterSpacing:'-2px'`, `lineHeight:1` |
| **26px** | — | 700, 800 | Nunito | Large chart tooltip values, donut chart center text |
| **36px** | `text-3xl` | 700, 800 | Nunito | Empty state icon-emoji size |
| **40px** | `text-4xl` | 700, 800 | Nunito | Hero-level metric display |

---

## 4. FONT WEIGHTS — SEMANTIC USAGE

| Weight | Class | Name | When to Use |
|---|---|---|---|
| **400** | `font-normal` | Regular | Body copy, muted descriptions, secondary text, date strings, passive table cells |
| **500** | `font-medium` | Medium | Dropdown option text, secondary button labels, notification secondary text |
| **600** | `font-semibold` | Semibold | Active filter tabs, table header `<th>` labels, primary entry name cell, login button text |
| **700** | `font-bold` | Bold | Section headers (14px), KPI sub-labels, card titles, CTA action buttons, chart tooltip values |
| **800** | `font-extrabold` | Extrabold ⭐ | **Most used heavy weight** — all KPI metric numbers, section uppercase labels, avatar initials, page `h1` headings (18px), sidebar brand name, badge text, export button text |
| **900** | `font-black` | Black (rare) | Status badge pills only (`COMPLETED`, `PROCESSING`, `FAILED`) — uppercase + letterSpacing pattern |

---

## 5. LETTER SPACING — EXACT VALUES

**Rule: Never use tracking as decoration. Every value has a specific semantic purpose.**

| Value | When to Use | Example Element |
|---|---|---|
| `letterSpacing: '-2px'` | Large KPI numbers only — pulls wide numerals into compact block | `fontSize:24, fontWeight:800, fontFamily:monoStack` (stat cards) |
| `letterSpacing: '-0.5px'` | Page-level `h1` headings — prevents oversized visual gaps | `fontSize:18, fontWeight:800` (Dashboard heading) |
| `letterSpacing: '-0.3px'` | Condensed sidebar brand name | `fontSize:15, fontStretch:'condensed', fontWeight:800` |
| `letterSpacing: 0` | Default — all body text, card titles, table cells, buttons | Majority of UI at 11–14px |
| `letterSpacing: '0.4px'` | Chat bot name header | `fontSize:12, fontWeight:700` |
| `letterSpacing: 0.5` | Employee ID / role badge in header | `fontSize:10, fontWeight:800, textTransform:'uppercase'` |
| `letterSpacing: 0.8` | Table column headers `<th>` | `fontSize:11–12, fontWeight:600–700` |
| `letterSpacing: 1` | **Most-used positive spacing** — ALL UPPERCASE section labels throughout | `fontSize:10–11, fontWeight:700–800, textTransform:'uppercase'` |
| `letterSpacing: '.05em'` | Status badge pill text | `fontSize:10, fontWeight:800` |

---

## 6. LINE HEIGHT — EXACT VALUES

| Value | When to Use | Tailwind Equiv |
|---|---|---|
| `lineHeight: 1` | Large KPI numbers and metric displays — treats number as a glyph block. Stat card labels. | `leading-none` |
| `lineHeight: '1.2'` | Two-line compact elements: date display, stat card top labels, any two-line pairing | `leading-tight` |
| `lineHeight: 1.4` | Onboarding/subtitle text where copy needs gentle breathing room | `~leading-snug` |
| `lineHeight: 1.5` | Long-form prose, message body text users actually read | `leading-relaxed` |
| `inherit / unset` | All other UI — buttons, labels, badges, table cells, nav items | default |

---

## 7. TEXT TRANSFORM & STYLING PATTERNS

| Pattern | Usage | Exact Style |
|---|---|---|
| **UPPERCASE Section Labels** | Every section divider label (Date Range, Export, KPI titles) | `fontSize:10, fontWeight:800, color:muted, textTransform:'uppercase', letterSpacing:1` |
| **UPPERCASE Status Badges** | Generation status pills: COMPLETED, PROCESSING, FAILED | `fontSize:10, fontWeight:900, uppercase, letterSpacing:'.05em'` + colored bg/text |
| **UPPERCASE Employee Badge** | Employee ID · Role text in header | `fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:0.5` |
| **Condensed App Name** | Sidebar brand "PPT Generator" | `fontSize:15, fontStretch:'condensed', fontWeight:800, letterSpacing:'-0.3px'` |
| **Italic / Placeholder** | Empty state messages, placeholder hints | `fontSize:13, fontStyle:'italic', color:muted` |
| **Truncation** | Long filenames, titles in table cells | `whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'` or `className='line-clamp-1'` |

---

## 8. COMPONENT-BY-COMPONENT SIGNATURES

Apply these exact type signatures to each Skynet component for visual parity with Timesheet.

### 8.1 Stat / KPI Cards (DashboardView)

```tsx
// Metric number (big value)
style={{ fontSize: 24, fontWeight: 800, fontFamily: monoStack, letterSpacing: '-2px', lineHeight: 1 }}

// Label above number (e.g. "TOTAL GENERATED")
style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}

// Sub-description below number
style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}
```

### 8.2 Section Headers

```tsx
// Section title (e.g. "Recent Generations")
style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: fontStack }}

// Section subtitle
style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}
```

### 8.3 Page `h1` Headings (All Views)

```tsx
// Top of every view page
<h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--color-text-primary)', margin: 0 }}>
  Operations Dashboard
</h1>
// Subheading below
<p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
  System Metrics & History
</p>
```

### 8.4 Tables (HistoryView, AdminView)

```tsx
// <th> header cells
<th style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, color: 'var(--color-text-muted)', fontFamily: fontStack, whiteSpace: 'nowrap' }}>
  FILENAME
</th>

// <td> primary text cell (title, name)
<td style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
  {title}
</td>

// <td> data cell — numbers, dates, IDs — ALWAYS use monoStack
<td style={{ fontSize: 14, color: 'var(--color-text-primary)', fontFamily: monoStack }}>
  {date}
</td>

// <td> secondary line within a cell
<span style={{ fontSize: 12, color: 'var(--color-text-accent-emp)' }}>
  {secondaryInfo}
</span>
```

### 8.5 Status Badge Pills

```tsx
// COMPLETED / PROCESSING / FAILED
<span style={{
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  // COMPLETED:
  background: 'rgba(22,163,74,0.12)',
  color: '#4ADE80',
  border: '1px solid rgba(22,163,74,0.20)',
  // PROCESSING:
  // background: 'rgba(37,99,235,0.12)', color: '#60A5FA', border: '...',
  // FAILED:
  // background: 'rgba(220,38,38,0.12)', color: '#F87171', border: '...',
  padding: '2px 8px',
  borderRadius: 4,
}}>
  COMPLETED
</span>
```

### 8.6 Sidebar Brand Header (MainLayout)

```tsx
// App name
<span style={{ fontSize: 15, fontStretch: 'condensed', fontWeight: 800, letterSpacing: '-0.3px' }}>
  PPT Generator
</span>

// Team label
<span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
  Q LABS · SWIFT OPS
</span>

// User name in header
<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
  {user.full_name}
</span>

// Employee ID
<span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-emp-text)' }}>
  {user.email} · EMPLOYEE
</span>
```

### 8.7 Buttons (All Views)

```tsx
// Primary action button
<button style={{ fontSize: 13, fontWeight: 700, fontFamily: fontStack, letterSpacing: 0 }}>
  INITIATE GENERATION
</button>

// Secondary/outline button
<button style={{ fontSize: 12, fontWeight: 600, fontFamily: fontStack }}>
  Export Logs
</button>

// Small pill/filter button — active
<button style={{ fontSize: 12, fontWeight: 600, color: 'white', fontFamily: fontStack }}>
  TW
</button>

// Small pill/filter button — inactive
<button style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)', fontFamily: fontStack }}>
  7d
</button>
```

### 8.8 Form Inputs (CreatorView, Login)

```tsx
// Input label
<label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-text-muted)' }}>
  Presentation Title
</label>

// Input text
<input style={{ fontSize: 16, fontFamily: fontStack, fontWeight: 400 }} />
// NOTE: 16px is intentional — prevents iOS zoom on mobile

// Textarea
<textarea style={{ fontSize: 13, fontFamily: fontStack, fontWeight: 400, lineHeight: 1.5 }} />
```

### 8.9 Avatar Initials

```tsx
<div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <span style={{ fontSize: 12, fontWeight: 800, color: 'white', fontFamily: monoStack }}>
    MP
  </span>
</div>
```

### 8.10 Navigation Items (Sidebar)

```tsx
// Nav item label (visible when expanded)
<span style={{ fontSize: 13, fontWeight: 600, fontFamily: fontStack }}>
  DASHBOARD
</span>

// Nav tooltip (on hover when collapsed)
<span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
  DASHBOARD
</span>
```

### 8.11 Status Bar (Bottom)

```tsx
// All status bar items
<span style={{ fontSize: 9, fontFamily: monoStack, fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
  SERVER: ONLINE
</span>
```

### 8.12 Chart Axes (if/when charts are added)

```tsx
// Always monoStack on chart axes — never Nunito for numeric/axis data
// ApexCharts config:
chart: {
  fontFamily: fontStack,  // chart labels
},
xaxis: { labels: { style: { fontFamily: monoStack, fontSize: '12px' } } },
yaxis: { labels: { style: { fontFamily: monoStack, fontSize: '12px' } } },
```

---

## 9. GLOBAL FIND & REPLACE — TAILWIND CLASS MIGRATIONS

Run these across all `.tsx` files to catch Tailwind-based font references:

| Find (Tailwind) | Replace (Tailwind) | Notes |
|---|---|---|
| `font-['Orbitron']` | `font-bold` | Drop Orbitron — weight carries the emphasis now |
| `font-['Share_Tech_Mono']` | `font-mono` | JetBrains Mono via `font-mono` |
| `font-['Rajdhani']` | `font-sans` | Nunito is now `font-sans` default |
| `font-mono` (everywhere) | `font-mono` | Keep — but confirm `--font-mono` CSS var points to JetBrains |
| `tracking-widest` on headings | remove or `tracking-tight` | Orbitron needed wide tracking; Nunito doesn't |
| `tracking-[0.25em]` | replace with `tracking-widest` max | Reduce tracking on headings |

---

## 10. QUICK REFERENCE CHEAT SHEET

Copy this to the top of any view when implementing:

```typescript
import { fontStack, monoStack } from '../lib/typography';

/*
  SKYNET TYPOGRAPHY — TIMESHEET SYSTEM
  ─────────────────────────────────────────────────────
  fontStack  = Nunito (ALL UI text)
  monoStack  = JetBrains Mono (numbers, IDs, dates, code)

  USE CASE                          SIZE   WEIGHT   FONT       NOTES
  ─────────────────────────────────────────────────────────────────────
  Section label (UPPERCASE)         10px   800      Nunito     uppercase, letterSpacing:1
  KPI number (big metric)           24px   800      Mono       letterSpacing:'-2px', lineHeight:1
  Card / section title              14px   700      Nunito     color:text-primary
  Page h1 heading                   18px   800      Nunito     letterSpacing:'-0.5px'
  Button text                     12-13px  700      Nunito     fontFamily: fontStack (explicit)
  Table header <th>                 11px   600      Nunito     letterSpacing:0.8, muted
  Table data (text)                 14px   600      Nunito
  Table data (numbers/IDs/dates)    14px   400      Mono       ALWAYS monoStack for numeric
  Body / description text           13px   400      Nunito     muted or text-primary
  Muted sub-label / hint            11px  400-500   Nunito     muted
  Status badge pill                 10px   900      Nunito     uppercase, letterSpacing:'.05em'
  Chart axis labels                 12px   400      Mono       ALWAYS monoStack on axes
  Input field text                  16px   400      Nunito     16px prevents iOS zoom
  Input label                       10px   800      Nunito     uppercase, letterSpacing:1
  Avatar initials                   12px   800      Mono
  Sidebar brand name                15px   800      Nunito     condensed, letterSpacing:'-0.3px'
  Status bar text                    9px   500      Mono       letterSpacing:0.05em
*/
```

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1 — Global Setup (30 min)
- [ ] Replace Google Fonts `@import` in `index.css` (remove Orbitron, Rajdhani, Share Tech Mono, Inter → add Nunito + JetBrains Mono)
- [ ] Replace `--font-headline`, `--font-body`, `--font-label`, `--fd`, `--fm`, `--fb` CSS variables
- [ ] Update `body` rule to use `font-family: var(--font)`
- [ ] Create `frontend/src/lib/typography.ts` with `fontStack` and `monoStack` exports
- [ ] Update `tailwind.config` (or `@theme` in Tailwind v4): set `fontFamily.sans` to Nunito, `fontFamily.mono` to JetBrains Mono

### Phase 2 — Component Updates (2–3 hrs)
- [ ] `MainLayout.tsx` — update brand name + user row typography
- [ ] `Sidebar.tsx` — update nav item font (remove Orbitron tracking)
- [ ] `Login.tsx` — update form inputs to 16px, labels to 10px/800, remove Orbitron from title
- [ ] `DashboardView.tsx` — update stat card numbers to 24px monoStack, labels to 10px uppercase
- [ ] `CreatorView.tsx` — update section labels, input labels, button text, tone/theme pills
- [ ] `HistoryView.tsx` — update `<th>` cells to 11px/600/0.8 tracking, `<td>` data cells to monoStack for dates
- [ ] `AdminView.tsx` — same table updates, section labels
- [ ] `PreviewView.tsx` — update any heading/label typography

### Phase 3 — Verification (30 min)
- [ ] Search codebase for any remaining `Orbitron` references → confirm zero
- [ ] Search for `Share Tech Mono` → confirm zero (only JetBrains Mono now)
- [ ] Search for `Rajdhani` → confirm zero
- [ ] Search for `font-['` → confirm no hardcoded font strings in Tailwind classes
- [ ] Visual check: stat card numbers look compact and tight (`letterSpacing:'-2px'`)
- [ ] Visual check: all UPPERCASE labels are 10px/800/letterSpacing:1
- [ ] Visual check: dates and IDs in tables use monospace

---

## 12. WHAT NOT TO CHANGE

- ✅ `material-symbols-outlined` — keep, used on login page and settings
- ✅ Terminal text labels (`SESSION_INIT`, `AWAITING_CREDENTIALS`) — keep the UPPERCASE pattern, just update the font underneath
- ✅ All `tracking-widest` on status bar and badge content — this maps to `letterSpacing:1` in the Timesheet system
- ✅ All `font-mono` Tailwind classes that refer to numeric/data content — just ensure the CSS var points to JetBrains Mono

---

*Source document: `Skynet_Typography_System.docx`*  
*Maintained by: Skynet Integration Team · Swift Ops*
