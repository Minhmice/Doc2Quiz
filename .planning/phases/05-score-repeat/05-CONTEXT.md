# Phase 05: Score & Repeat - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers **end-of-session scoring** (X/Y, percentage), a **per-question outcome breakdown**, **wrong-answer tracking** tied to each study set, a **“Drill mistakes”** path that starts a session containing only questions missed in the last completed run, and **persistence** of that history across reloads (IndexedDB — already partially implemented).

**In scope (ROADMAP + SCORE-01–04):** results UI on the quiz flow, drill entry, persistence semantics matching REQUIREMENTS, integration with existing `PlaySession` + `activityTracking`.

**Explicitly out of scope for Phase 5:** analytics dashboards beyond what already consumes `quizSessions`; cloud sync; clearing wrong history as a **required** user-facing feature (optional later only); dedicated marketing-style **results landing route** unless planner proves necessary.

**Architecture note:** Phase 4 CONTEXT described practice on `src/app/page.tsx`; the **shipped** v1 flow is **`/sets/[id]/play`** and `src/components/play/PlaySession.tsx`. Phase 5 work **anchors to the study-set play route** and extends the **session complete** state there — not the legacy single-page sketch.

</domain>

<decisions>
## Implementation Decisions

### 1. Where results live
- **D-01:** **Inline on `/sets/[id]/play`:** When the last question is answered, replace the active-question card body with the **full results** experience (same **`Card` + `shadow-lg`** family as in-progress quiz), per `.planning/phases/05-score-repeat/05-UI-SPEC.md`. **No** new `/sets/[id]/results` route for v1 unless a planner-discovered blocker forces it.
- **D-02:** Page chrome (**Take quiz · …** header, stepper) may remain visible; results content lives **inside** the main column card, not a separate full-bleed page.

### 2. Data & persistence
- **D-03:** Use **`recordQuizCompletion`**, **`getMistakeQuestionIds`**, **`hasMistakesForStudySet`** (`src/lib/studySet/activityTracking.ts`) and existing object stores **`quizSessions`** / **`studyWrongHistory`**. **Do not** add a parallel persistence scheme unless a gap is found during implementation.
- **D-04:** **Silent clear** of `studyWrongHistory` when a completed session has **zero** wrong IDs — **already implemented**; remains the v1 contract (no confirmation modal).

### 3. Results content
- **D-05:** Show **percentage** (rounded integer, 0–100) and **X / Y correct** in one **hero** line; subtitle for wrong count or “nothing to drill” per UI-SPEC copy table.
- **D-06:** **Per-question breakdown:** one row per question **in session order**; outcomes **correct / incorrect** only (MCQ binary). **ScrollArea** when count > ~8; row min height **44px** for touch.
- **D-07:** Reuse **emerald / red** row semantics consistent with option reveal in `PlaySession` (Phase 04 UI used “teal” in prose; **ship** matches emerald — do not re-litigate in Phase 5).

### 4. Actions & navigation
- **D-08:** **Primary CTA:** **Drill mistakes** → **`/sets/{studySetId}/play?review=mistakes`** (existing `PlaySession` prop `reviewMistakesOnly`). Use **`Link` + `Button asChild`**. **Disabled** (not hidden) when `wrongCount === 0`, with **`title`** / tooltip explaining why.
- **D-09:** **Quiz again** — restarts session in place (reset index, picks, counts) without leaving route.
- **D-10:** **Open library** — navigate to **`/dashboard`** (outline); label may shorten to **Library** only with `aria-label` / tooltip that includes “Open library” (per approved UI-SPEC).

### 5. Feedback duplication
- **D-11:** **Toast** on session complete (`PlaySession` today) vs **card** hero — **dedupe or soften** toast so users are not told the score twice (executor chooses: remove toast, shorten toast, or gate on “results UI visible”).

### 6. Optional destructive UX
- **D-12:** **No** mandatory **“Clear mistake history”** control in Phase 5. If added as stretch, use **`AlertDialog`** copy from `05-UI-SPEC.md` and **`destructive`** button — not in critical path for SCORE-01–04.

### the agent's Discretion
- Exact **ScrollArea** threshold (8 vs 10 rows).
- Whether **roving tabindex** on breakdown rows is worth cost vs list semantics only.
- Minor **toast** wording / removal strategy under D-11.
- Extracting **`QuizResultsPanel`** (or similar) from `PlaySession` vs inline JSX — whichever keeps files maintainable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & requirements
- `.planning/ROADMAP.md` — Phase 5 goal, deliverables, acceptance criteria
- `.planning/REQUIREMENTS.md` — §Score & Repeat (SCORE-01–04), mapping table
- `.planning/PROJECT.md` — keyboard-first, local-only, core value loop

### Phase 5 design contract
- `.planning/phases/05-score-repeat/05-UI-SPEC.md` — spacing, typography, color, results layout, CTAs, copy, registry

### Prior phase locks (continuity)
- `.planning/phases/04-practice-engine/04-CONTEXT.md` — Phase 4 / Phase 5 boundary (what Phase 4 deferred to Phase 5)
- `.planning/phases/04-practice-engine/04-UI-REVIEW.md` — shipped play UI vs old spec gaps (emerald, route)

### Implementation anchors
- `src/components/play/PlaySession.tsx` — session flow, completion, `reviewMistakesOnly`, empty states
- `src/lib/studySet/activityTracking.ts` — `recordQuizCompletion`, `getMistakeQuestionIds`, stats / events
- `src/app/(app)/sets/[id]/play/page.tsx` — headline, `?review=mistakes`
- `src/lib/db/studySetDb.ts` — IndexedDB shape if store changes are needed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`PlaySession`** — already calls `recordQuizCompletion`, shows **Session complete** card with counts, **Take quiz again**, **Library**; loads drill mode from **`getMistakeQuestionIds`** when `reviewMistakesOnly`.
- **shadcn:** `Card`, `Button`, `Badge`, `Alert`, `Progress`, `Separator`, `ScrollArea` (declare in UI-SPEC if added).
- **`ACTIVITY_STATS_CHANGED_EVENT`** — dashboard listeners already refresh when a session is recorded.

### Established patterns
- **Client-only** quiz state in React; **no** new server routes required for SCORE persistence.
- **Toast** (`sonner`) for per-answer and session-complete feedback — align with D-11.

### Integration points
- Extend **`PlaySession`** `finished` branch (or extract subcomponent) for **breakdown + Drill mistakes** ordering per UI-SPEC.
- **`play/page.tsx`** — no structural change required beyond optional copy tweaks.

</code_context>

<specifics>
## Specific Ideas

- Results should feel like **the same session** “closing the book” — not a jarring new product surface (card continuity from `05-UI-SPEC.md`).
- **Drill mistakes** must stay **one tap** from results for the core loop (“score → repeat mistakes”).

</specifics>

<deferred>
## Deferred Ideas

- **Per-question timing / speed stats** — backlog (analytics phase).
- **Export session PDF** — new capability; not Phase 5.
- **Leaderboards / sharing** — out of scope per PROJECT.md.

### Reviewed Todos (not folded)
- `todo match-phase 05` returned **no matches** — nothing folded from backlog.

</deferred>

---
*Phase: 05-score-repeat*
*Context gathered: 2026-04-08*
