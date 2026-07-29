# Phase 7: Normalize App Information Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 07-normalize-app-information-architecture-around-setid-based-qu
**Areas discussed:** route migration, set detail screen, library filtering, sidebar behavior, practice nav

---

## Route migration

| Option | Description | Selected |
|--------|-------------|----------|
| Gradual with redirects | Add new routes; keep old URLs redirecting | |
| Big-bang rename | Switch internal links; minimal redirects | |
| Hard cutover | Delete legacy routes; 404 old URLs | ✓ |

**User's choice:** Hard cutover. Delete `/edit/new/quiz`, `/edit/quiz/[id]`, `/sets/[id]/source`, `/flashcards/[id]`, aliases, redirects, guards, and dead components. Replace with `/dashboard`, `/create`, `/quiz/*`, `/flashcard/*` tree including `drill-mistake` and `results` (not `done`). Preserve DB set IDs.

**Notes:** Create flow is wizard inside `/quiz/create` and `/flashcard/create` (Source → Convert → Generate → Review). Review and Edit remain separate routes.

---

## Set detail screen

| Option | Description | Selected |
|--------|-------------|----------|
| Land on review route | Cards open `/review` directly | |
| New overview route | `/quiz/[setId]` and `/flashcard/[setId]` as set home | ✓ |
| Dashboard modal | Detail drawer on dashboard | |

**User's choice:** Status-driven overview at `/quiz/[setId]` and `/flashcard/[setId]` with CTAs by readiness, secondary actions, and max-3-item preview (no answers on quiz preview; flashcard front only).

---

## Library filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard query params | `/dashboard?type=quiz\|flashcard\|all` | ✓ |
| Separate library routes | `/library/quizzes`, etc. | |
| Client-only filter | URL stays `/dashboard` | |

**User's choice:** URL is source of truth for `type`, `search`, `sort`, `status`, `practice`. Default `type=all`. No localStorage persistence.

---

## Sidebar behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar-primary shell | Left nav + slim top bar | ✓ |
| Keep top bar + add sidebar | Both visible | |
| Three-state route rules only | expanded/collapsed/hidden by route | |
| User-toggleable collapse | Manual pin/collapse + route rules | ✓ |

**User's choice:** Force-hide only on play and drill-mistake with Exit button. Results restore normal shell. Mobile bottom nav on top-level pages only; compact top bar on nested workflows; no hamburger primary nav.

---

## Practice nav

| Option | Description | Selected |
|--------|-------------|----------|
| Smart resume | Unfinished session → recent overview → empty dashboard | ✓ |
| Global mistake picker | `/dashboard?practice=mistakes` filtered library | ✓ |
| In-app /help | Dedicated help page | ✓ |
| Server-persisted sessions | Resume survives reload | ✓ |

**User's choice:** Compact resume menu only when multiple unfinished sessions. Mistake drills CTA opens type-specific `drill-mistake` route.

---

## Claude's Discretion

Breadcrumb/title copy, sidebar collapse tokens, resume picker UI细节, `/help` MVP depth, internal helper naming.

## Deferred Ideas

- Review/edit tab merge
- Legacy redirects
- Hamburger drawer primary nav
- localStorage library filter persistence
