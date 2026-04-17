# Phase 05: Score & Repeat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Canonical decisions: `05-CONTEXT.md`.

**Date:** 2026-04-08  
**Phase:** 05 — Score & Repeat  
**Mode:** Non-interactive host session (no `AskUserQuestion` / menu). Gray areas were resolved using **recommended defaults** aligned with `05-UI-SPEC.md`, ROADMAP Phase 5, REQUIREMENTS SCORE-*, prior Phase 04 boundary text, and codebase scout (`PlaySession.tsx`, `activityTracking.ts`).

**Areas covered (synthetic):** Results surface · Persistence · Breakdown · CTAs · Toast dedupe · Optional clear-history

---

## Results surface & route

| Option | Description | Selected |
|--------|-------------|----------|
| Inline results on `/sets/[id]/play` | Same card family, no new route | ✓ |
| Dedicated `/sets/[id]/results` | Separate page for score | |
| Modal-only results | Overlay instead of card swap | |

**User's choice:** Inline on play route (recommended — matches `05-UI-SPEC` and shipped architecture).  
**Notes:** Phase 4 CONTEXT still mentions `page.tsx`; implementation uses study-set play — CONTEXT.md records **D-01** for planners.

---

## Per-question breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Full list with ScrollArea | Session order, correct/incorrect badges | ✓ |
| Collapsed “View details” | Reduces noise | |
| No breakdown | Score only | |

**User's choice:** Full list with scroll when > ~8 rows (`05-UI-SPEC`).

---

## Drill mistakes & empty drill

| Option | Description | Selected |
|--------|-------------|----------|
| Link to `?review=mistakes` + disabled CTA when 0 wrong | Stable layout, explicit tooltip | ✓ |
| Hide Drill button when 0 wrong | Simpler but layout shift | |

**User's choice:** Disabled Drill + tooltip (UI-SPEC).

---

## Toast vs card score announcement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe / soften / remove finish toast | Avoid double score messaging | ✓ (executor discretion under D-11) |
| Keep both | Redundant | |

**User's choice:** Executor discretion to avoid duplicate score UX.

---

## Clear mistake history (user-facing)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to post–v1 optional feature | Silent IDB clear only today | ✓ |
| Ship AlertDialog clear in Phase 5 | Extra scope | |

**User's choice:** Optional only; not required for SCORE-01–04.

---

## the agent's Discretion

- Scroll threshold, breakdown roving tabindex, toast exact behavior, component extraction (`QuizResultsPanel`).

## Deferred Ideas

Captured in `05-CONTEXT.md` `<deferred>` (timing stats, export, leaderboards).
