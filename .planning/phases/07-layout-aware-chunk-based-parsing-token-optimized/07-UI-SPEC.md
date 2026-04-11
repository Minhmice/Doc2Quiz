---
phase: "07"
slug: layout-aware-chunk-based-parsing-token-optimized
status: approved
shadcn_initialized: true
preset: "base-nova · neutral · cssVariables · tailwind v4 (components.json)"
created: 2026-04-11
---

# Phase 07 — UI Design Contract

> Visual and interaction contract for layout-aware chunk parsing, parse modes, timing (D-27–D-29), and chunk debug UI. Sources: `07-CONTEXT.md` (D-14–D-29), `07-RESEARCH.md`, `REQUIREMENTS.md` (AI-05), repo `AiParseSection.tsx`, `OcrInspector.tsx`, `globals.css`, `components.json`.

---

## Phase scope (UI)

| Area | Contract |
|------|------------|
| Parse modes | Fast / Accurate / Hybrid labels, persistence, placement vs Parse CTA |
| Progress & timing | Reuse Progress + status copy; add **one** run wall-clock line (D-28) when known |
| Debug | Chunk parse debug: table + optional raw; **collapsed by default** (D-26) |
| Fallback copy | Short inline note when full-page vision fallback contributed (D-03, RESEARCH risks) |
| A11y | Focus order, `aria-expanded`, labeled controls |
| Empty debug | No OCR / no chunks / vision-only run |

### Visual hierarchy (first read)

- **Primary focal:** the primary parse action — **Parse with AI** (embedded dashed card) or **Parse** (full section footer after `border-t`). Use `size="lg"` / primary styling so it dominates the control column.
- **Secondary focal:** **Parse strategy** group (radio / tabs / select) — user chooses mode **before** starting; placed **above** the primary CTA in both full and embedded layouts.
- **Tertiary:** attach-page-image + Run OCR checkboxes, hints, inline progress, summary, then **Parse time** line (D-28) when shown.
- **Inspector column:** `OcrInspector` card title + page picker first; chunk debug disclosure last so OCR remains the default mental model.

---

## Parse mode control

### Behavior (locked from CONTEXT + code)

| Mode | User-facing label | Subtitle (one line each) |
|------|-------------------|---------------------------|
| `fast` | **Fast** | OCR layout chunks → small text prompts; full-page vision only if chunks fail. Needs OCR enabled. |
| `hybrid` | **Hybrid** | Uses Fast when OCR looks strong (≥85% pages successful, no failed pages); otherwise full vision like Accurate. |
| `accurate` | **Accurate** | Full-page vision parse. Highest recall on hard layouts. |

### Control pattern

- **Default (repo-aligned):** Vertical **radio group** inside the existing bordered control stack (`rounded-lg border border-border bg-muted/30 px-4 py-3`), with `role="radiogroup"` and `aria-labelledby` pointing at the visible **“Parse strategy”** `Label` — matches `AiParseSection.tsx` (`parseStrategyControl`).
- **Acceptable variants (executor picks one, do not ship two):**
  - **Segmented:** shadcn **Tabs** (`role="tablist"`) with three tabs = three modes; same values and copy as table above.
  - **Select:** shadcn **Select** + **Label** (`htmlFor` on trigger id) e.g. label text **“Parse mode”**; options Fast / Accurate / Hybrid with same subtitles in `SelectItem` description or helper text below.

### Placement vs Parse CTA

- **Full** (`variant="full"`): Order inside section — heading → intro → **Attach page image** → **Run OCR before vision** → **Parse strategy** → hints → inline progress → errors → summary → preview → **border-t** → **Parse** + **Cancel parsing (stop AI processing)** (when cancel control is shown).
- **Embedded** (`variant="embedded"` on `/sets/[id]/source`): When key + PDF ready, show **same three controls** (attach, OCR, strategy) **above** the dashed “Ready to generate questions” card; primary **Parse with AI** remains in that card. Mode must be visible **before** the user starts parse (same mental model as full).

### Persistence (localStorage)

- **Key (only — do not invent new keys for mode):** `doc2quiz:parse:strategy`
- **Values:** exactly `"fast" \| "accurate" \| "hybrid"` (string stored as written).
- **Read/write:** On mount / hydration-safe read (avoid SSR mismatch); write immediately on change (existing `setParseStrategyPreference` pattern).
- **Default when missing / invalid:** `"accurate"` (matches `readParseStrategyPreference` in code).

*Pre-populated from:* `07-CONTEXT.md` D-14, D-16–D-17, D-22; `AiParseSection.tsx` (`LS_PARSE_STRATEGY`).

---

## Progress + summary

### Existing patterns (do not regress)

- **While running:** Status line (`text-sm font-medium text-primary`) + shadcn **Progress** when `!visionRendering && progress.total > 0` — same thresholds and `aria-live="polite"` wrapper as `AiParseSection` `showInlineProgress`.
- **Summary:** After success, `summary` string (`text-sm text-foreground`, `aria-live="polite"`) — keep existing wording for chunk vs vision; executor may append timing per below.

### Run total wall time (D-28)

- **Format:** `Parse time: 12.4s` — **one decimal** place, fixed `s` suffix, no ms in this line.
- **Placement (primary):** **Immediately below** the summary paragraph in the parse section (same column width as summary). **Secondary (optional duplicate):** muted, **Monospace / debug** token (`text-xs` per Typography) in `OcrInspector` header row **only if** it aids correlation with chunk table; do not add a third location.
- **When to show:** Only when a **terminal** run completed for the last user-triggered parse and `lastParseRunWallMs` (or equivalent) is a **finite number ≥ 0**. **While running or if unknown:** **omit the line entirely** (no placeholder, no spinner on this line).
- **Semantics copy (footer to same line or next muted line, max one extra sentence):** If the run included **document-level vision fallback** (`needsVisionFallback` / merged with vision), append: `Includes full-page vision fallback.` so users do not assume the number is chunk-AI-only (*mitigation from* `07-RESEARCH.md` risks).

*Pre-populated from:* `07-CONTEXT.md` D-28, D-29; `07-RESEARCH.md` §Instrumentation / UI.

---

## Debug / OCR inspector extension (“Chunk parse debug”)

### Location

- **Preferred:** Extend **`OcrInspector`** with an optional bottom section (or sibling **Card** titled **“Chunk parse debug”**) so chunk timings sit with OCR context on `/sets/[id]/source` (*per* D-26, `07-RESEARCH.md`).
- **Collapsible container:** Native **`<details>`** / `<summary>` **or** shadcn **Card** with a disclosure button — either is valid; **default state = collapsed** so happy path unchanged (D-26).

### Disclosure semantics

- If **`<details>`:** rely on native `open` state; no duplicate `aria-expanded` on `<summary>` (browser exposes expanded state). Ensure **`<summary>`** is keyboard-focusable and has clear visible focus ring (`outline-ring/50` from base styles).
- If **button + Card:** button controls panel visibility and must expose **`aria-expanded={boolean}`** and **`aria-controls`** pointing at the panel `id`.

### Table — required columns

| Column | Content | Notes |
|--------|---------|--------|
| **Chunk id** | `layoutChunkId` | **`font-mono`**, **`text-xs` only** (same token as raw `<pre>` — see Typography **Monospace / debug**), truncate with `title` full id |
| **Outcome** | Chunk outcome enum / short label | Badge optional (`secondary` / `destructive` for errors) |
| **Expanded retry** | Yes / No or checkmark | Maps to `usedExpandedText` (or equivalent) |
| **AI time** | Sum of per-chunk AI wall ms | Header label **`AI time`**; data from **`chunkAiWallMs`**; show `—` only if value missing for that row |
| **Attempts** (optional column) | `parseAttempts` | If space-constrained, fold into a tooltip on AI time |

### Per-attempt breakdown (optional)

- If `attemptWallMs?: number[]` exists: show as **second line** in cell or nested `<details>` per row: `Attempt 1: 420ms · Attempt 2: 310ms` in monospace, **collapsed by default**.

### Raw model output (D-15 / D-25)

- **Not** on `Question`; in session/debug payload only.
- Show **per chunk** inside a **nested `<details>`** (“Raw output”) **collapsed by default**, `<pre className="max-h-40 overflow-auto ... font-mono text-xs">` — **no ad-hoc pixel sizes**; must match **Monospace / debug** row in Typography.

### `pipelineLog`

- Verbose chunk timing logs remain gated per **06-CONTEXT D-05** / `isPipelineVerbose()` — **not** part of end-user UI; no change to user-visible contract.

*Pre-populated from:* `07-CONTEXT.md` D-15, D-25–D-29; `07-RESEARCH.md`.

---

## Fallback messaging (vision after chunks)

Use **short** copy (toast and/or summary suffix). Align with existing toasts in `AiParseSection` where applicable.

| Situation | Copy direction |
|-----------|----------------|
| Chunk path merged with vision | Summary already may include “merged with full-page vision…” — **keep**; ensure **Parse time** footnote mentions inclusion when D-28 shown (*see above*). |
| Vision fallback failed, chunks kept | Match existing toast intent: **“Vision fallback failed; keeping layout-chunk results only.”** |
| Hybrid chose vision (OCR gate) | Log-only is OK; **optional** one-line status during run: **“OCR quality below threshold — using full-page vision.”** (no alarm tone; `text-muted-foreground`) |
| No OCR data, vision only | Optional toast pattern exists for OCR failure — **do not** blame user; **“No OCR layout available — using full-page vision for this run.”** |

*Pre-populated from:* `07-CONTEXT.md` D-03, D-16, D-22–D-23; `07-RESEARCH.md` vision fallback risk row.

---

## Accessibility

### Focus order (parse source page)

1. Replace PDF / preview controls (`PdfInfoCard` as implemented).
2. **Attach page image** checkbox → **Run OCR** checkbox → **Parse strategy** radios (Tab through group per browser) **or** Tabs / Select trigger.
3. **Parse with AI** (embedded primary) → **Cancel parsing (stop AI processing)** when visible (same accessible name as Copywriting Contract).
4. **OcrInspector:** **Page** `SelectTrigger` → page content (checkbox overlay, scroll regions) → **Chunk parse debug** disclosure → debug table scroll region (tab stop only if focusable controls inside).
5. `QuestionMappingDebug` as already ordered.

### Labels

- **Parse strategy:** Visible group label **“Parse strategy”** (`aria-labelledby` on radiogroup) — existing.
- **Select (if used for mode):** `Label` + `SelectTrigger` `id` association — mirror `OcrInspector` **Page** + `pageSelectId` pattern.
- **Progress region:** Keep `aria-live="polite"` on the block that includes status + progress + summary + parse time line.

### Collapsible debug

- **`aria-expanded`** required when disclosure is **not** native `<details>` (see above).

*Pre-populated from:* WCAG 2.2 disclosure patterns; repo `OcrInspector.tsx`, `AiParseSection.tsx`.

---

## Empty states (chunk debug)

| State | What the debug panel shows |
|-------|----------------------------|
| **No OCR stored** (`OcrInspector` `!run`) | Keep existing **Card** empty copy (“No OCR run stored…”). **Chunk parse debug** section: **hidden** OR single muted line: **“Chunk debug appears after OCR data exists.”** — prefer **hidden** to reduce noise. |
| **OCR exists but 0 layout chunks** | Section visible when user expands: table header + **one row** or empty body message: **“No layout chunks built from this OCR run.”** |
| **Accurate-only run** (vision path, no chunk AI) | Same as zero chunks: **“No chunk AI calls in this run (Accurate / vision-only).”** Run total line (D-28) **still allowed** if orchestration exposes it. |
| **Parse aborted mid-run** | Show **partial** rows + partial run time if available; outcome column may show **aborted** / stale — executor follows `07-RESEARCH.md` abort guidance. |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (New York–style registry; project **style: base-nova**) |
| Preset | `components.json`: **base-nova**, **neutral** base, **cssVariables: true**, Tailwind entry `src/app/globals.css`, **iconLibrary: lucide** |
| Component library | Radix primitives via shadcn |
| Icon library | **lucide-react** (where icons are needed; parse section may stay text-only) |
| Font | **`font-sans`** / `--font-body` for UI; **`font-heading`** / `--font-display` for page titles (see `source/page.tsx`) |

*Pre-populated from:* `components.json`, `src/app/globals.css`, `src/app/(app)/sets/[id]/source/page.tsx`.

### Phase 7 component inventory

Reuse existing: **Button**, **Progress**, **Badge**, **Alert** (`AlertTitle` / `AlertDescription`), **Label**, **Card** / **CardHeader** / **CardTitle** / **CardDescription** / **CardContent**, **Select** (inspector page picker). **No new third-party registries** (`components.json` → `"registries": {}`).

---

## Spacing Scale

Declared values (multiples of 4; align with Tailwind + existing panels):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight inline gaps, table cell padding-y |
| sm | 8px | Control gaps (`gap-2`), Card header tight spacing |
| md | 16px | Default `space-y-4` / section `space-y-6` |
| lg | 24px | Major column gaps (`lg:grid-cols-2` gap) |
| xl | 32px | Large empty-state padding (`p-10` / `sm:p-12`) |
| 2xl | 48px | Section breaks (rare) |
| 3xl | 64px | Page-level (rare) |

**Exceptions:** Touch-friendly controls: minimum **44×44px** hit target for primary **Parse** / **Cancel** where not already satisfied (shadcn `size="lg"` on embedded CTA already aligns).

---

## Typography

**Hard limits (checker / contract):** at most **four distinct font sizes** and **two font weights** across Phase 07 UI (including parse section, summaries, and chunk debug). Do not introduce `text-[10px]`, `text-[11px]`, or other arbitrary sizes.

| Role | Tailwind | Approx. size | Weight | Line height |
|------|-----------|--------------|--------|-------------|
| **Body** | `text-base` | 16px | **400** | 1.5 |
| **Helper / default dense UI** | `text-sm` | 14px | **400** | 1.5 |
| **Label / card title / in-progress status** | `text-sm font-semibold` (or `text-base font-semibold` when matching **Body** 16px size — same pixel bucket) | **14px** default; **16px** only when paired with `text-base` | **600** | 1.25 |
| **Display (page title)** | `text-2xl font-semibold` (use **`sm:text-2xl`** only — do **not** add `text-3xl` for this phase) | **24px** max | **600** | 1.2 |
| **Monospace / debug** (chunk id, table data, `<pre>` raw, optional duplicate parse time) | **`text-xs`** + `font-mono` | **12px** (Tailwind `text-xs`) | **400** | 1.4 |

**Weights (exactly two):** **400** (body, table data, monospace debug) and **600** (labels, headings, page title, emphasis). **Do not use `font-bold` / weight 700** in Phase 07 surfaces covered by this contract.

---

## Color

| Role | Value (light) | Usage |
|------|-----------------|-------|
| Dominant (60%) | **`#fafafa`** (`--background`) | Page background |
| Secondary (30%) | **`#ffffff`** (`--card`), **`#f5f5f5`** (`--muted`) | Cards, dashed empty panel (`bg-muted/20`), inset panels |
| Accent (10%) | **`#6366f1`** (`--primary`) | **Primary Button**, **in-progress status** (`text-primary`), **focus ring** (`--ring`), **links** (`text-primary`), radio **`accent-primary`** |
| Destructive | **`#dc2626`** (`--destructive`) | Errors, Cancel while running, destructive `Alert` |

**Accent reserved for:** primary actions (Parse), key links (Settings), active/progress emphasis, focus rings — **not** for large surfaces or table zebra backgrounds.

**Semantic overlays (OCR inspector only — existing):** bbox **`sky-400`** tint; polygon **amber** stroke — keep for visual consistency when touching inspector.

*Pre-populated from:* `src/app/globals.css` `:root`.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **Parse with AI** (embedded) / **Parse** (full section footer) |
| Empty state heading | **Ready to generate questions** |
| Empty state body | **AI reads each page as an image and extracts multiple-choice questions. You can run again if results look off.** |
| Error state | Keep **Alert** pattern: title **Error** + body = normalized message; include **next step** (“Check your model and try again.” / Settings link where applicable) |
| Parse time (new) | **`Parse time: {n.n}s`** (+ optional **Includes full-page vision fallback.**) |
| Chunk debug empty | **No chunk AI calls in this run (Accurate / vision-only).** / **No layout chunks built from this OCR run.** |
| Destructive confirmation | **Cancel parsing (stop AI processing)** — visible button label everywhere this control appears (full + embedded); **no modal** unless product adds one later; destructive styling indicates consequence. |

*Pre-populated from:* `src/app/(app)/sets/[id]/source/page.tsx`, `AiParseSection.tsx`, `REQUIREMENTS.md` AI-05.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, Progress, Badge, Alert, Label, Card, Select (and Tabs only if segmented mode chosen) | not required — project `registries: {}` |
| Third-party | **none** | n/a |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-11 (gsd-ui-checker)

---

## Traceability

| ID | UI contract |
|----|-------------|
| AI-05 | Progress + summary + optional parse time line reinforce feedback during extraction |
| D-14, D-16–D-29 | Modes, OCR/vision paths, inspector extension, timings — sections above |

*End of UI design contract — Phase 07.*
