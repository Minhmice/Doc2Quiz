# Phase 20 — Research (AI-first create flow, quiz vs flashcards, product parse chrome, dev OCR)

**Researched:** 2026-04-11 · **Mode:** repo-first  
**Confidence:** **HIGH** for current file/layout facts; **MEDIUM** for IDB/schema ergonomics; **LOW** for production-hardening of `/dev/ocr` without an explicit threat model sign-off.

One-line summary: Split the **create funnel** and **parse UI chrome** using existing `AiParseSection` + `source/page.tsx` composition, persist **`contentKind`** on `StudySetMeta` without an IndexedDB version bump, and add **`/dev/ocr`** as thin routes that **import the same components**—never a second parse engine.

## Executive summary

- **Funnel:** Today `src/app/(app)/sets/new/page.tsx` is upload-only [VERIFIED: `sets/new/page.tsx`]; plans `20-01` / `20-02` already specify Option B (`/sets/new` selector → `/sets/new/quiz` | `/sets/new/flashcards`) [VERIFIED: `20-01-PLAN.md`, `20-02-PLAN.md`].
- **Parse chrome:** `AiParseSection` already has `variant: "full" | "embedded"`; **embedded** still mounts `AiParsePreferenceToggles` + `AiParseParseStrategyPanel` when key+file exist [VERIFIED: `AiParseSection.tsx` ~1791–1850]; product hiding needs a **new** prop (e.g. `surface`) per `20-02-PLAN.md`.
- **Source page:** `OcrInspector` and `QuestionMappingDebug` are **siblings** of `AiParseSection`, not children—hide them in `source/page.tsx` when `surface === "product"` [VERIFIED: `source/page.tsx` ~294–321].
- **IDB meta:** `StudySetMeta` is an object in store `"meta"` with `put(meta)`—adding optional fields is a **TypeScript + write-path** change; `DB_VERSION` is `5` in `src/types/studySet.ts` and `touchStudySetMeta`’s `Pick<>` must grow when new meta fields are patchable [VERIFIED: `studySet.ts`, `studySetDb.ts`].
- **Dev OCR:** No `src/app/**/dev/**` routes exist yet [VERIFIED: glob `src/app/**/dev/**/*.tsx` → 0 files]; compose `OcrInspector` + link to full `/sets/[id]/source` per `20-02-PLAN.md`.

<user_constraints>
## User Constraints (from `20-CONTEXT.md`)

`20-CONTEXT.md` does not use `## Decisions` / `## Claude's Discretion` headings; the following are **verbatim intent** extracted from that file.

### Locked product direction

- Refactor the **product-facing** create flow: Dashboard → **choose Quiz vs Flashcards** → upload → AI parse → review → save/use.
- **OCR must not appear** in the main learner flow (no prominent toggle/panel/copy); OCR code **stays** in the repo.
- **Dev-only surface** (e.g. `/dev/ocr`) for OCR/debug; **reuse** parse-domain modules—**no duplicated pipeline**.
- **Do not break** the parse vs learning boundary from Phase 16 (`docs/ARCHITECTURE-domain-boundaries.md`).

### Deferred / non-goals (this phase)

- Do not delete OCR modules, `parseRoutePolicy`, or unified engine.
- No full dashboard redesign; no new cloud sync/auth/backend.
- Do not polish the dev OCR page like production; do not solve all math/OCR edge cases here.
</user_constraints>

## Standard Stack

| Piece | Version / fact | Role in Phase 20 | Notes |
|--------|----------------|------------------|--------|
| Next.js (App Router) | **^15.2.4** in repo [VERIFIED: `package.json`]; **16.2.3** latest on npm registry as of this research run [VERIFIED: `npm view next version`] | Route groups `src/app/(app)/…`, client pages with `"use client"` | Stay on 15.x unless a separate upgrade phase; research does not require Next 16. |
| React | **^19.0.0** [VERIFIED: `package.json`] | Client-only pages for IDB + file APIs | Matches current pattern on `sets/new` and `sets/[id]/source`. |
| IndexedDB via `indexedDB.open(DB_NAME, DB_VERSION)` | `DB_NAME = "doc2quiz"`, **`DB_VERSION = 5`** [VERIFIED: `src/types/studySet.ts`, `studySetDb.ts` `openDb`] | Persist `StudySetMeta` including new `contentKind` | No new object store required for a new meta field. |
| Existing parse UI | `AiParseSection`, `OcrInspector`, `QuestionMappingDebug`, overlays [VERIFIED: `source/page.tsx` imports] | Product vs developer chrome split | No new OCR runner libraries. |

**Prescriptive stack decision for this phase:** Add **only** TypeScript fields + UI props + routes; **do not** add alternative persistence or a parallel OCR stack.

## Architecture Patterns

### 1) Route layout under `src/app/(app)/sets/new/`

**What:** Keep the `(app)` layout shell; add **sibling routes** `quiz/page.tsx` and `flashcards/page.tsx` next to `page.tsx` so URLs are `/sets/new`, `/sets/new/quiz`, `/sets/new/flashcards` [CITED: `20-01-PLAN.md` tasks 2–4].

**Why this repo:** `NewStudySetPage` already centralizes `ensureStudySetDb` → `getPdfPageCount` → `extractPdfText` → `generateStudySetTitle` → `createStudySet` → `router.push(/sets/[id]/source)` [VERIFIED: `sets/new/page.tsx`]. **Move** that client implementation into typed upload pages; root becomes selector only [CITED: `20-01-PLAN.md` task 4].

**Global CTAs:** Dashboard, `AppTopBar`, `CommandPalette` should all target **`/sets/new`** (selector), not `/sets/new/quiz` from global chrome [CITED: `20-01-PLAN.md` task 5, `20-UI-SPEC.md` §4].

### 2) `contentKind` on `StudySetMeta` (quiz | flashcards)

**What:** Extend `StudySetMeta` with `contentKind?: "quiz" | "flashcards"` (or required on new creates); **`undefined` ⇒ treat as legacy / “developer chrome”** on source per `20-02-PLAN.md` task 2.

**Write paths:** `createStudySet` builds `meta` today without `contentKind` [VERIFIED: `studySetDb.ts` ~445–454]. Extend input + `meta` object. **`touchStudySetMeta`** uses `Pick<StudySetMeta, …>`—add `contentKind` to that pick when meta should be patchable [VERIFIED: `studySetDb.ts` ~514–520].

### 3) Split **AiParseSection UI** without duplicating the parse engine

**Fact:** Orchestration (OCR sequential, vision, chunk parse, `parseChunk`, IDB draft writes) lives **inside** `AiParseSection.tsx` (~2k lines) [VERIFIED: imports and state at top of `AiParseSection.tsx`].  
**Fact:** `variant="embedded"` only toggles header/progress/preview layout; it **does not** remove preference toggles or strategy panel when `hasKey && activePdfFile` [VERIFIED: `AiParseSection.tsx` ~1831–1850].

**Prescriptive approach:** Add **`surface?: "product" | "developer"`** (name per `20-02-PLAN.md`) with **default `"developer"` when omitted** so unknown callers keep today’s behavior. When `surface === "product"`:

- Omit **direct** `<AiParsePreferenceToggles />` render (or gate behind Advanced) [CITED: `20-02-PLAN.md` task 1].
- Collapse or hide **`AiParseParseStrategyPanel`** behind `<details>` labeled **Advanced** (default closed) [CITED: `20-02-PLAN.md` task 1].
- Grep JSX string literals for user-visible **"OCR"** inside `AiParseSection` (embedded progress still says e.g. `OCR text extraction…` at ~1878–1879) [VERIFIED: `AiParseSection.tsx`]—product mode should reword **primary** status strings per `20-UI-SPEC.md` §5.

**Do not** extract a second `runOcrSequential` / `runVisionSequential` pipeline into `/dev/ocr`; **compose** `OcrInspector` (+ optional link to `/sets/[id]/source`) [CITED: `20-02-PLAN.md` task 3].

### 4) `source/page.tsx`: inspectors are **outside** `AiParseSection`

**Prescriptive wiring:** Compute `surface` from loaded `meta` (`contentKind` quiz/flashcards ⇒ `"product"`, else `"developer"`) [CITED: `20-02-PLAN.md` task 2]. Pass `surface` into `AiParseSection`. Conditionally mount **`OcrInspector`** / **`QuestionMappingDebug`** only when `surface === "developer"` **or** `?debug=1` via `useSearchParams` [CITED: `20-02-PLAN.md` task 2, `20-UI-SPEC.md` §5].

**Redirect behavior today:** Successful parse schedules `router.push(/sets/[id]/review)` after 2s [VERIFIED: `source/page.tsx` ~204–210]. For flashcards, `20-02-PLAN.md` task 4 calls out CTA toward **`/sets/[id]/flashcards/review`** and/or adjusting overlay continue—planner should reconcile **quiz** vs **flashcards** redirect so flashcard creators are not dropped onto MCQ review unintentionally [CITED: `20-02-PLAN.md`; **MEDIUM** confidence until implemented].

### 5) Dev route guarding (`/dev/ocr`)

**Options already in plan:** (a) `process.env.NODE_ENV !== "production"` → `notFound()`; (b) `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB` (or similar) [CITED: `20-02-PLAN.md` task 3].

**Repo pattern note:** `NODE_ENV` is build-time inlined in Next—suitable for **stripping** dev routes from production bundles when combined with dead-code patterns [ASSUMED: Next bundling behavior; **LOW** confidence for edge cases like `next start` with custom env]. **`NEXT_PUBLIC_*`** is readable client-side—use only as a **soft gate** (anyone can enable in their browser if they set env at build); pair with “no dashboard links” as already required [VERIFIED: `20-02-PLAN.md` acceptance `rg` on dashboard].

**Next.js `notFound()`:** Use in a **Server Component** page or layout for a hard 404; if pages stay `"use client"`, call `notFound` from a small **server** parent wrapper or use redirect—planner should pick one pattern to avoid “client-only page always mounts” surprises [ASSUMED: App Router split; **MEDIUM** confidence—verify against Next 15 docs during implementation].

### 6) IndexedDB: new meta field **vs** `DB_VERSION` bump

**Observation:** `meta` store uses `put` of full `StudySetMeta` objects; **`onupgradeneeded`** only creates stores/indexes, not per-record schema [VERIFIED: `studySetDb.ts` ~50–86].

**Prescriptive guidance:** Adding **`contentKind`** does **not** require bumping **`DB_VERSION`** *for structural reasons*—existing records simply omit the field until written [VERIFIED: IDB object store pattern in this file]. **Do** bump `DB_VERSION` when you add **stores, indexes, or migration logic** that must run in `onupgradeneeded`.

**Risk:** Any code that assumes a **closed** union on `StudySetMeta` keys must treat missing `contentKind` as legacy (already specified in `20-02-PLAN.md`) [CITED].

### 7) Flashcard interim model

**Backlog option 1:** Derive cards from `Question[]`—front = stem, back = correct option text [VERIFIED: `docs/BACKLOG-flashcards.md` §Data model options]. **`20-02-PLAN.md`** explicitly uses `getDraftQuestions` / `putDraftQuestions` for a minimal review route [CITED].

**Boundary:** Flashcard **review** stays in learning/session routes; **parsing** still produces `Question[]` via existing AI path until a dedicated flashcard prompt exists [CITED: `20-CONTEXT.md` §3.3, `ARCHITECTURE-domain-boundaries.md`].

### 8) `AiParseSection` prop surface vs feature flags

**Today:** `variant` controls full vs embedded presentation [VERIFIED: `AiParseSection.tsx` props ~123–134, `isEmbedded` ~216]. **`surface`** (product vs developer) is **orthogonal**: embedded source page can be product while still using `variant="embedded"` for layout [DESIGN: merges `20-02` with existing API].

**Anti-pattern:** Overloading `variant` with three meanings (layout + chrome + content kind)—use **`surface` + `meta.contentKind`** on the page, not more `variant` values [ASSUMED: maintainability; aligns with `20-02-PLAN.md` threat “prop explosion”].

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Second OCR / vision pipeline for dev | New “lab” engine copying `runOcrSequential` | `OcrInspector` + link to `/sets/[id]/source` | Single source of truth for OCR blobs + debug props already passed from `source/page.tsx` [VERIFIED: `source/page.tsx` ~307–315]. |
| New storage type for flashcards v1 | `Flashcard[]` store + migration | `Question[]` + mapping in review UI | Backlog recommends option 1 for speed [VERIFIED: `BACKLOG-flashcards.md`]. |
| Custom IDB client | Raw stores per feature | `ensureStudySetDb`, `createStudySet`, `getStudySetMeta`, `putStudySetMeta` | Central logging + transactions already exist [VERIFIED: `studySetDb.ts`]. |
| Bypassing learning/parse boundary | Import `runVisionSequential` from `flashcards` components | Keep parse drivers only under `AiParseSection` / `source` / dev parse pages | Normative rules in `ARCHITECTURE-domain-boundaries.md` [VERIFIED]. |

## Common Pitfalls

### Pitfall 1: Hiding toggles but leaving “dead” parse preferences

**What goes wrong:** `surface === "product"` hides `AiParsePreferenceToggles`, but internal state still reads `readEnableOcrPreference()` and runs OCR—user cannot change a stuck false preference.  
**Mitigation:** Either keep **Advanced** disclosure that exposes toggles, or reset-to-sensible defaults when entering product mode [ASSUMED: UX; **MEDIUM** confidence].

### Pitfall 2: `useSearchParams` without `Suspense`

**What goes wrong:** Next static optimization / bfcache warnings or runtime dev overlay when `useSearchParams` is used in a client page without a boundary.  
**Established repo fix:** Mirror `src/app/(app)/sets/[id]/play/page.tsx`: inner component uses `useSearchParams`, default export wraps with `<Suspense fallback={…}>` [VERIFIED: `play/page.tsx` ~94–105]. Apply the same if `source/page.tsx` reads `debug=1` at root.

### Pitfall 3: `touchStudySetMeta` silently drops `contentKind`

**What goes wrong:** Patching meta with a narrowed `Pick` type omits new fields from spread patches—less likely if you always `{...existing, ...patch}`, but **type** may block passing `contentKind`.  
**Fix:** Extend the `Pick<StudySetMeta, …>` union in `touchStudySetMeta` when creators need to change kind [VERIFIED: `studySetDb.ts` ~514–520].

### Pitfall 4: Flashcards routed to MCQ review

**What goes wrong:** `handleParseFinished` always navigates to `/sets/[id]/review` [VERIFIED: `source/page.tsx` ~204–210, ~326].  
**Fix:** Branch on `meta.contentKind === "flashcards"` for overlay CTA + timer redirect [CITED: `20-02-PLAN.md` task 4].

### Pitfall 5: Marketing copy on upload pages contradicts product mode

**What goes wrong:** New `sets/new` strings still say “vision” / “OCR” in headings (today’s root copy mentions “AI vision” [VERIFIED: `sets/new/page.tsx` ~127–128]).  
**Fix:** Use **`20-UI-SPEC.md` §2–3** strings (“Create quiz from file”, etc.) [CITED].

### Pitfall 6: Validation / Nyquist

`workflow.nyquist_validation` is **true** in `.planning/config.json` [VERIFIED]. This phase is UI-heavy—if no automated tests exist yet, gate with **`npm run lint` + `npm run build`** per plans [VERIFIED: `20-01-PLAN.md`, `20-02-PLAN.md` verification sections] and document manual smoke in SUMMARY.

### Pitfall 7: `[ASSUMED]` items need confirmation before locking

| ID | Claim | Risk if wrong |
|----|--------|----------------|
| A1 | `NODE_ENV` gate fully removes dev OCR exposure in all deployment targets | Dev route might still ship; verify on real production build |
| A2 | No `DB_VERSION` bump for `contentKind` alone | **Low** risk given object `put` pattern [VERIFIED in repo] |

## Code Examples

### IndexedDB meta write (existing pattern)

```ts
// Pattern: merge existing meta, then put (supports new optional fields).
// Source: src/lib/db/studySetDb.ts — touchStudySetMeta / putStudySetMeta
await putStudySetMeta({
  ...existing,
  ...patch,
  updatedAt: new Date().toISOString(),
});
```

### Source page composition (inspectors are siblings)

```tsx
// Pattern: conditionally render tools next to AiParseSection, not inside it.
// Source: src/app/(app)/sets/[id]/source/page.tsx (excerpt)
<AiParseSection
  ref={parseRef}
  studySetId={id}
  activePdfFile={pdfFile}
  pageCount={meta.pageCount ?? null}
  variant="embedded"
  /* surface={surface} — to be added per 20-02 */
/>
<OcrInspector studySetId={id} pdfFile={pdfFile} /* … */ />
<QuestionMappingDebug studySetId={id} pdfFile={pdfFile} /* … */ />
```

### `useSearchParams` + `Suspense` (repo precedent)

```tsx
// Source: src/app/(app)/sets/[id]/play/page.tsx
export default function StudySetPlayPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <StudySetPlayPageInner />
    </Suspense>
  );
}
```

## RESEARCH COMPLETE
