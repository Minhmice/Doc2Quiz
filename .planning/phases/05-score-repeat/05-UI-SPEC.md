---
phase: 05
slug: score-repeat
status: draft
shadcn_initialized: true
preset: base-nova
created: 2026-04-08
---

# Phase 05 — UI Design Contract

> Visual and interaction contract for **Score & Repeat** (SCORE-01–04). Align with **shipped play route** (`/sets/[id]/play`, `PlaySession.tsx`) and **globals.css** tokens; Phase 04 UI-SPEC used teal/emerald as “correct” — **current code uses emerald** for correct feedback; Phase 05 keeps that pairing for continuity until a global palette pass.

**Sources:** `.planning/REQUIREMENTS.md` §Score & Repeat, `.planning/ROADMAP.md` Phase 5, `.planning/PROJECT.md` (keyboard-first, local-only), `src/components/play/PlaySession.tsx`, `src/lib/studySet/activityTracking.ts`, `src/app/(app)/sets/[id]/play/page.tsx`, `src/app/globals.css`, `components.json` + `npx shadcn info`, `.planning/phases/04-practice-engine/04-UI-SPEC.md`, `.planning/phases/04-practice-engine/04-UI-REVIEW.md` (gaps vs spec).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova (`npx shadcn info` — Next.js 15 App Router, Tailwind v4, `src/app/globals.css`) |
| Component library | Radix primitives via shadcn/ui (base registry) |
| Icon library | lucide-react |
| Font | `--font-sans` / `--font-body` for UI chrome and breakdown body; `--font-heading` / `--font-display` for page `h1` and results hero line (match **Take quiz** header on `play/page.tsx`) |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps, badge padding |
| sm | 8px | Tight stacks (row gaps inside breakdown) |
| md | 16px | Card content padding, footer button gaps |
| lg | 24px | Header margin below title block (`mb-6` pattern on play page) |
| xl | 32px | Between results “hero” and breakdown section |
| 2xl | 48px | Rare page-level vertical rhythm |
| 3xl | 64px | Page-level max width gutters only if full-bleed layout added |

**Exceptions:** Touch-friendly breakdown rows: minimum **44px** hit height per row (padding + line box), still on 4px grid (e.g. `py-3` + content).

---

## Typography

| Role | Size | Weight | Line height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 12px | 600 | 1.35 |
| Heading | 20px | 600 | 1.2 |
| Display | 36px at `sm` and up, 28px below | 700 | 1.1 |

**Weights used:** 400 (body), 600 (labels, card titles), 700 (display score / % only).

**Tabular numbers:** Use `tabular-nums` on **X/Y**, **%**, and any numeric badges (match live `Badge` on active quiz).

---

## Color

Map to **semantic tokens** in `globals.css` (light/dark). Approximate hex shown for light `:root`.

| Role | Token / value | Usage |
|------|---------------|--------|
| Dominant (~60%) | `--background` (#fafafa light / #0f172a dark) | Page canvas behind cards |
| Secondary (~30%) | `--card`, `--secondary`, `--border` | Results `Card`, breakdown rows, separators |
| Accent (~10%) | `--primary` / `--ring` (indigo family) | **Primary actions** (Drill mistakes when enabled), focus rings, primary links |
| Success (outcome) | Emerald family — match play: `emerald-500` / `emerald-950/40` borders-bg for **Correct** rows and correct count highlights |
| Error / wrong | `destructive` / red row treatment — match play: `red-400/50` border, `red-950/40` bg for **Incorrect** rows |
| Muted copy | `--muted-foreground` | Secondary lines, hints, truncated stem |

**Accent reserved for:** Primary CTA (**Drill mistakes**), default-style **Quiz again** if only one primary in footer, focus rings, indigo **Library** as outline/secondary unless Drill is sole default. **Do not** paint every breakdown row with primary; rows use success/error neutrals.

**Destructive token (`--destructive`):** Reserved for destructive confirmations only (e.g. clear history), not for ordinary “wrong answer” styling.

---

## Results & session complete

**Surface:** Same **`Card` + `shadow-lg`** as in-progress quiz (`PlaySession`) so the flow feels like one component family.

**Structure (top → bottom):**

1. **`CardHeader`**
   - **`CardTitle`:** `Session complete` (sentence case, match current).
   - **Hero line:** One line combining **percentage** and **fraction** — e.g. “**84%** · **21 / 25** correct” where **%** uses **Display** typography and **X/Y** uses **Heading** or semibold **Body** with `tabular-nums`. Percentage = `Math.round(100 * correct / total)` with **0%** and **100%** allowed.
   - **`CardDescription`:** Short factual subtitle — e.g. wrong count: “**4** to review” or “All correct — nothing to drill.”

2. **Optional `Separator`** between summary and breakdown when breakdown is shown.

3. **`CardContent`** — per-question breakdown (see next section).

4. **`CardFooter`** — actions (see **CTAs** below).

**Full page vs card:** Keep results **inside the play route’s main column** (not a separate marketing-style full bleed). Page `h1` remains **Take quiz · {title}** until navigation away; results replace the question card body only.

---

## Per-question breakdown

**Data:** One row per question **in session order** with outcome **correct** or **incorrect** (MCQ is binary; no “partial” state in v1).

**Layout:** Vertical **list** of compact rows inside **`ScrollArea`** when count is greater than ~8; otherwise no scroll. Row height ≥ **44px** interactive affordance if rows are focusable.

**Each row:**

- **Leading:** 1-based index `Q{n}` in **Label** style, `tabular-nums`, muted.
- **Body:** Truncated question stem (single line with `truncate` or `line-clamp-2` — pick one in implementation and stay consistent); **16px / 400 / 1.5**.
- **Trailing:** **`Badge`** — `Correct` (emerald styling consistent with option reveal) / `Incorrect` (red styling consistent with wrong option). Use `variant="secondary"` + explicit utility overrides if needed to match play colors.

**Keyboard / a11y:**

- Container: `role="region"` + `aria-labelledby` pointing at **Session complete** (or a dedicated **Results summary** `h2` inside the card if you split headings for semantics).
- Breakdown list: `role="list"` with each row `role="listitem"`. If rows are not links, expose **Tab** order: **Drill mistakes** → **Quiz again** → **Library** first; optionally **roving `tabindex`** on rows with **↑/↓** for scan-only users — minimum bar: screen readers get list semantics and visible badges.

---

## CTAs & placement

| Action | Variant | Placement | Enabled when |
|--------|---------|-----------|--------------|
| **Drill mistakes** | `default` (primary) | **First** in footer row (before **Quiz again**) | `wrongCount > 0` |
| **Quiz again** | `outline` or `secondary` | After primary | Always |
| **Library** | `outline` | End of row | Always |

**Drill mistakes** navigates to **`/sets/{id}/play?review=mistakes`** (existing contract with `getMistakeQuestionIds` / `studyWrongHistory`). Use Next.js **`Link`** styled as button or **`Button asChild`** for consistency.

**Disabled zero-mistakes state:** Render **Drill mistakes** as **`disabled`** with `aria-disabled="true"` and **`title`** (or `Tooltip`): “You did not miss any questions in this session.” Do not hide the control — keeps layout stable.

---

## Edge & empty states

| Scenario | UI |
|----------|-----|
| **Zero mistakes** | Primary line celebrates or neutral “Perfect run”; Drill disabled as above; **Quiz again** + **Library** unchanged. |
| **All wrong** | Still show **%** and **0/N**; Drill enabled with copy implying full set review. |
| **Drill route with no stored mistakes** | Keep existing **`Alert`**: “No missed questions to review” + **Take full quiz** (already in `PlaySession`). |
| **IndexedDB / load error** | Keep **`Alert variant="destructive"`** pattern; copy: problem + path (**retry** / **Library**). |
| **Persistence restored (optional)** | Subtle **muted** one-liner under header or above card: “Progress is saved on this device.” No modal; dismiss not required for v1. |

---

## Destructive / irreversible

**v1 Phase 5 (SCORE-01–04):** No required user-facing destructive action. Wrong history clears when **last session had zero wrong IDs** (`activityTracking` deletes `studyWrongHistory` row) — **silent**, no confirmation.

If product adds **“Clear mistake history”** later: use shadcn **`AlertDialog`**; title **Clear mistake history?**; body **This removes saved missed questions for this set on this device. It cannot be undone.**; confirm **Clear** (`destructive` variant), cancel **Cancel**.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **Drill mistakes** |
| Session title | **Session complete** |
| Hero (template) | **{pct}%** · **{correct} / {total}** correct |
| Subline (has mistakes) | **{n}** to review |
| Subline (no mistakes) | All correct — nothing to drill. |
| Secondary CTA | **Quiz again** |
| Tertiary / nav | **Library** |
| Toast on finish (optional; may dedupe with card) | **Session complete: {correct}/{total} correct** — if kept, avoid conflicting **%** only in toast |
| Empty drill (play `?review=mistakes`) | **No missed questions to review** / body: **Finish a quiz with at least one incorrect answer to populate review mistakes, or take the full quiz instead.** / button **Take full quiz** |
| Error (load bank) | **Could not load question bank.** + retry or return path |
| Destructive confirmation | **Clear mistake history**: **This removes saved missed questions for this set on this device. It cannot be undone.** |

---

## Registry Safety

| Registry | Blocks used | Safety gate |
|----------|-------------|-------------|
| shadcn official (`components.json` → `registries: {}`) | Existing: `card`, `button`, `badge`, `alert`, `progress`, `separator`, `scroll-area`, `tooltip`; add if needed: `alert-dialog` for future clear-history | Official registry — **view not required** |
| Third-party | **none** | n/a |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
