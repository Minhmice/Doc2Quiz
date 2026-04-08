# Phase 04 — UI Review

**Audited:** 2026-04-08 (revision — Playwright visual pass)  
**Baseline:** `.planning/phases/04-practice-engine/04-UI-SPEC.md` (+ Phase 04 CONTEXT / execution summaries)  
**Screenshots:** **Captured** with Playwright CLI against a **clean production** server (`rm -rf .next && npm run build`, then `PORT=3001 npx next start`). Files live under `.planning/ui-reviews/04-20260408-playwright/` (directory is gitignored for `*.png` — keep captures locally for regression comparison).

**Environment notes**

- **`npm run dev` on :3000** was returning **HTTP 500** / plain “Internal Server Error” during this audit because **`.next` was inconsistent** (ENOENT for `app-build-manifest.json` under `server/app/(app)/...`). After a **clean rebuild**, routes responded normally. If dev 500s again, try **`rm -rf .next`** and restart dev (or use `next build` + `next start` for stable screenshots).
- Playwright **`npx playwright install chromium`** was used; browsers live in the Playwright cache, not necessarily in `package.json`.

**Implementation note:** Phase 04 summaries reference `PracticeSection` on `src/app/page.tsx`. The current product routes practice through **`/sets/[id]/play`** and **`src/components/play/PlaySession.tsx`**. This audit scores **live UI** (where visible) against the **written UI-SPEC** and records **automated** findings from screenshots.

---

## Automated verification (Playwright)

| Capture | Viewport | What we see | Spec / product notes |
|--------|----------|-------------|----------------------|
| `dashboard-desktop.png` | 1440×900 | App shell: **Doc2Quiz** brand, search, **+ Create New Set**, **Library** heading, **empty state** (“No study sets yet”, dashed region, **Import PDF**), stat cards | Empty state copy is clear and actionable. Header shows **API Down** (red) — degraded-mode indicator; worth a dedicated test/assertion if CI adds Playwright. |
| `dashboard-mobile.png` | 375×812 | Same shell scaled narrow | Layout holds; primary actions remain discoverable. |
| `sets-new-desktop.png` | 1440×900 | **New study set** title, short explainer, dashed **drag-and-drop** upload zone | Strong focal point; copy explains local PDF + AI step. |
| `play-empty-desktop.png` | 1440×900 | Stepper with **3. Quiz** active; **Take quiz · …**; hint **Keys 1–4**; body **Loading…** | Stepper provides wayfinding. Screenshot taken shortly after navigation — client still on loading path (`PlaySession` + IndexedDB). For E2E, **wait for** alert/card content or use a **seeded study set id**. |

**needs_human_review:** Whether **teal vs emerald** for “correct” is acceptable brand drift; screenshot evidence is on the quiz card once data loads (not in the loading frame above).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Dashboard / new set / play hints are specific; empty states guide next action. Minor generic **Loading…** only. |
| 2. Visuals | 3/4 | Shell + stepper + cards give **clear hierarchy** (confirmed visually). **Question map** for the quiz card still **absent** vs `04-UI-SPEC.md`. |
| 3. Color | 2/4 | Spec: **teal** correct feedback; **`PlaySession` uses emerald**. Primary actions use **indigo/purple** from tokens — coherent app-wide but not the literal Phase 04 teal wording. |
| 4. Typography | 3/4 | Display font on titles, readable body; dashboard and play header hierarchy read well in screenshots. |
| 5. Spacing | 3/4 | Cards, dashed empty regions, and header rhythm are consistent; no obvious cramped breakpoints in captured viewports. |
| 6. Experience Design | 2/4 | Loading / error / empty **paths exist in code**; Playwright caught **global shell** (**API Down**) and a **loading** frame on play before data settled. Still **missing vs spec:** question map, **Previous/Next**, **~500ms auto-advance**, **focusable session root**. |

**Overall: 16/24** (prior code-only pass was 15/24; **+1 Visuals** after confirming layout/hierarchy in screenshots.)

---

## Top 3 Priority Fixes

1. **Reconcile feedback color with the design contract** — Spec: teal for correct; code: emerald in `PlaySession.tsx`. Either align classes or **update `04-UI-SPEC.md`** to the shipped palette.

2. **Question map + clamped prev/next** — Still required by `04-UI-SPEC.md` / CONTEXT; progress bar + stepper do not replace per-question map inside the session card.

3. **Stable dev + E2E waits** — Document or script **clean `.next`** when Turbopack leaves manifests missing; in Playwright, **assert** quiz UI only after **`getByRole` / network-idle / IndexedDB seed** so “Loading…” does not false-fail.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **Strong:** `PlaySession` empty states point to Review or full quiz; dashboard empty state invites **Import PDF** (`play-empty-desktop` / dashboard captures align with messaging).
- **Minor:** `Loading…` / `Loading image…` remain generic.

### Pillar 2: Visuals (3/4)

- **From screenshots:** Top bar, library grid, and new-set upload focal area are **clean and scannable**. Stepper on set flow clarifies **Quiz** step.
- **Gap:** No **N-cell question map** under/beside the stem in the quiz UI (spec §Question map).

### Pillar 3: Color (2/4)

- **Unchanged from code audit:** Emerald correct states; orange/amber empty-bank alert; global **primary** indigo in `globals.css`.

### Pillar 4: Typography (3/4)

- Titles and muted subtitles separate clearly in dashboard and **New study set** views.

### Pillar 5: Spacing (3/4)

- Empty library dashed container and upload dropzone use generous, consistent padding in screenshots.

### Pillar 6: Experience Design (2/4)

- **Playwright:** Play route showed **Loading…** in the captured frame — treat as signal to add **deterministic waits** or **fixtures** for quiz E2E.
- **Product:** **API Down** in header is a real degraded state — good for transparency; ensure it does not block purely local flows if that is the product goal.
- **Spec gaps:** map, prev/next, auto-advance, session `focus()` — still open vs `04-UI-SPEC.md`.

---

## Registry Safety

`components.json` has **`"registries": {}`**. No third-party shadcn registry blocks required a source audit. No registry flags.

---

## Files Audited

- `.planning/phases/04-practice-engine/04-UI-SPEC.md`
- `.planning/phases/04-practice-engine/04-CONTEXT.md`
- `.planning/phases/04-practice-engine/04-0*-SUMMARY.md` (spot-check)
- `src/components/play/PlaySession.tsx`
- `src/app/(app)/sets/[id]/play/page.tsx`
- `src/app/globals.css`
- `.planning/ui-reviews/.gitignore`
- Playwright outputs: `.planning/ui-reviews/04-20260408-playwright/*.png`

---

## UI REVIEW COMPLETE

**Phase:** 04 — Practice Engine (**UI** sweep = app shell + quiz route + spec delta)  
**Overall Score:** 16/24  
**Screenshots:** Captured (paths above; PNGs not committed)

### Pillar Summary

| Pillar | Score |
|--------|-------|
| Copywriting | 3/4 |
| Visuals | 3/4 |
| Color | 2/4 |
| Typography | 3/4 |
| Spacing | 3/4 |
| Experience Design | 2/4 |

### Top 3 Fixes

1. Teal vs emerald (or spec update).  
2. Question map + prev/next.  
3. Clean `.next` / Playwright wait strategy + optional API indicator tests.

### File Updated

`.planning/phases/04-practice-engine/04-UI-REVIEW.md`

### Recommendation Count

- Priority fixes: 3  
- Minor: API Down semantics, alt text on MCQ images, toast density
