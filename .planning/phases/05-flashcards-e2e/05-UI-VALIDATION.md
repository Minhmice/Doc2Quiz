# UI-SPEC Review — Phase 5

**Phase:** 5 - Flashcards & E2E  
**Reviewed:** 2026-07-25  
**Spec:** `.planning/phases/05-flashcards-e2e/05-UI-SPEC.md`  
**Compared against:** `05-CONTEXT.md`, `.planning/REQUIREMENTS.md` (FLASH-01–07, CORE-MIST-01, MODE-01), `04-UI-SPEC.md` (format parity)

---

## Verdict Summary

```
UI-SPEC Review — Phase 5

Dimension 1 — Copywriting:     BLOCK
Dimension 2 — Visuals:         FLAG
Dimension 3 — Color:           PASS
Dimension 4 — Typography:      PASS
Dimension 5 — Spacing:         PASS
Dimension 6 — Registry Safety: PASS

Status: BLOCKED
```

**Overall:** BLOCKED — Dimension 1 must be fixed before planning. All other dimensions are PASS or non-blocking FLAG.

---

## Dimension Results

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| 1 Copywriting | BLOCK | AlertDialog dismiss uses generic label `Cancel` (line 144); otherwise 50+ strings with solution paths on errors |
| 2 Visuals | FLAG | ASCII layouts and interaction states present; no explicit focal-point / visual-hierarchy declaration per primary screen |
| 3 Color | PASS | 60/30/10 declared; accent reserved list is specific; destructive token declared; stitch theme scope boundary documented |
| 4 Typography | PASS | Exactly 4 sizes (12/14/24/30px) and 2 weights (400/800); line heights declared; flashcard-play scope exception documented |
| 5 Spacing | PASS | Scale uses standard set (4–64px, multiples of 4); exceptions (6px stripe, 240px TOC, 72ch prose, 44px touch targets) justified |
| 6 Registry Safety | PASS | shadcn official only (already in repo); @animate-ui unused; no third-party blocks requiring vetting |

---

## Requirements & Context Alignment

| Requirement / Decision | UI-SPEC coverage |
|------------------------|------------------|
| FLASH-01 | Step 1 wizard: `memorize` / `understand` / `exam_preparation` with labels + sublabels |
| FLASH-02 | Step 2: `entire_document` / `selected_sections` + checkbox list from `canonical_sections` |
| FLASH-03 | Step 3: `recommended` / `custom` with 5–60 validation |
| FLASH-04 | `Format: {label}` line + API value → display label mapping |
| FLASH-05 | Backend scope (canonical-only); UI shows generation progress, no raw-doc exposure |
| FLASH-06 | Progress step `Saving to library`; post-generate `pipeline_stage = 'flashcards'` |
| FLASH-07 | Redirect `/flashcards/{id}`; `Start flashcards` on resume strip, dashboard, done page |
| CORE-MIST-01 | `Drill mistakes` on dashboard + quiz done (first CTA when mistakes exist); E2E verification spec |
| MODE-01 Flashcards | Enable Flashcards CTA; sets `content_kind` + `mode_selected`; inline wizard |
| D-01–21 (`05-CONTEXT.md`) | All locked decisions reflected; inline wizard resolves D-04; legacy vocab excluded (D-05) |
| Deferred (edit workspace, spaced repetition) | Correctly omitted or deferred |

**Format parity with Phase 4:** Frontmatter, Design System, Spacing, Typography, Color, Copywriting, Registry Safety, Screens & Layout, route-specific interaction specs, Interaction States, Accessibility, Motion, Implementation Notes, Checker Sign-Off — all present. Phase 5 appropriately extends Phase 4 patterns (mode footer, generation card, done page, dashboard CTAs).

**Accessibility & motion:** WCAG 2.1 AA, wizard `fieldset`/`legend`, `aria-live`/`aria-busy`, enabled Flashcards no longer `aria-disabled`, touch targets ≥44px on wizard options — all declared.

**Banned patterns:** Anti-slop rules honored — no modal-first wizard, no new tokens, progress stripe scoped to generation card, stitch theme not leaked into wizard/library shells.

---

## Blocking Issues

### Dimension 1 — Copywriting

- **Generic dismiss label `Cancel`:** Re-generate `AlertDialog` declares `cancel 'Cancel'` (Copywriting Contract → Flashcards resume strip). Checker BLOCK list explicitly forbids `Cancel` as a CTA label.
  - **Fix:** Replace with a specific dismiss label, e.g. `Keep existing cards` or `Go back`.

---

## Recommendations (non-blocking)

### Dimension 1 — Copywriting

- **Single-word navigation CTAs:** `Back`, `Continue`, `Done`, `Library`, and mode selectors `Quiz` / `Flashcards` are single-word labels. Consider verb+noun pairs where clarity helps (e.g. `Continue setup`, `Finish session`) — or document rationale as mode/navigation tokens (same pattern as Phase 4 FLAG).
- **Re-generate exposure:** Spec notes executor may omit `Generate again` if destructive without confirm — confirmation copy is declared when exposed; ensure executor does not ship re-generate without the `AlertDialog`.

### Dimension 2 — Visuals

- **Focal points:** Add one line per primary surface declaring visual anchor:
  - `/sets/[id]/source` (mode): enabled **Flashcards** outline button + **Quiz** oxblood primary in footer strip
  - `/sets/[id]/source` (wizard): step headline (`What's your learning goal?`, etc.)
  - `/sets/[id]/source` (generating): progress card headline (`Generating flashcards…`)
  - `/flashcards/[id]/done`: H1 `Session complete · {title}`
  - `/quiz/[id]/done` (mistakes): **Drill mistakes** as first oxblood CTA when `hasMistakes`
- **Tab order:** Wizard could declare: option cards → Back → Continue/Generate (match Phase 4 recommendation).

---

## ISSUES FOUND

**Phase:** 5 - Flashcards & E2E  
**Status:** BLOCKED  
**Blocking Issues:** 1

### Dimension Results
| Dimension | Verdict | Notes |
|-----------|---------|-------|
| 1 Copywriting | BLOCK | Generic `Cancel` in re-generate AlertDialog |
| 2 Visuals | FLAG | Layouts documented; add explicit focal-point declarations |
| 3 Color | PASS | Specific accent reservation + 60/30/10 |
| 4 Typography | PASS | 4 sizes, 2 weights, line heights |
| 5 Spacing | PASS | 4px grid + documented exceptions |
| 6 Registry Safety | PASS | No new third-party registry blocks |

### Blocking Issues
- **Dimension 1 — Copywriting:** AlertDialog dismiss label is generic `Cancel` — must be replaced with a specific action label (e.g. `Keep existing cards`).

### Recommendations
- Optionally strengthen wizard/done/navigation CTA labels with verb+noun pairs (non-blocking).
- Add per-screen focal-point lines to match Phase 3/4 accessibility depth (non-blocking).

### Action Required
Fix blocking issue in `05-UI-SPEC.md` and re-run `/gsd-ui-phase`.
