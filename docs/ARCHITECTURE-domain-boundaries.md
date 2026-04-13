# Domain boundaries: document ingestion / parse vs learning

**Last inventoried:** 2026-04-11

Contributor quick-start remains [`CLAUDE.md`](../CLAUDE.md); this document is the deeper contract for how those three engines split across code paths and what learning-facing code may depend on.

## Purpose & non-goals

This file defines **architectural boundaries** between:

1. **Document ingestion / parse** — everything that turns a PDF (or images) into draft or approved `Question` records, including OCR, vision, chunking, and AI extraction.
2. **Learning / session** — review, play, practice, flashcards, scoring, wrong-answer loops, and any UX that consumes questions **after** they exist in storage.

**Non-goals:** This phase does **not** require rewriting [`AiParseSection.tsx`](../src/components/ai/AiParseSection.tsx) or collapsing the parse pipeline into smaller modules. Those are separate refactors. Here we only document rules and start a **stable import surface** for learning UI (`src/lib/learning/`, see Phase 16 plan `16-02`).

## Two domains

### Document ingestion / parse

Rough ownership:

- `src/lib/pdf/**` — pdf.js text extraction, page rasterization for vision.
- `src/lib/ai/**` — OCR adapters, vision runners, `parseChunk`, layout chunks, `parseRoutePolicy`, dedupe, mapping to pages, `ocrDb`, staging helpers, etc.
- `src/components/ai/**` — parse orchestration UI (`AiParseSection`, preview lists, strategy panels).
- `src/app/api/ai/**` — forward/staging/test routes for multimodal and related server endpoints.
- `src/app/api/parse-jobs/**` — optional server-side parse queue (Phase 15 scale mode).

**Produces:** Draft questions, OCR blobs, vision staging metadata, parse progress, logs. **Persists** via [`studySetDb`](../src/lib/db/studySetDb.ts) and types in [`src/types/studySet.ts`](../src/types/studySet.ts) / [`src/types/question.ts`](../src/types/question.ts).

Learning surfaces **must not** call into multimodal **runners** (vision/OCR sequential loops, `parseChunk` execution) directly; they work on **already materialized** `Question` rows and study-set metadata.

### Learning / session

Rough ownership:

- `src/app/(app)/sets/[id]/review/`, `play/`, `practice/` (redirect), `flashcards/`, `done/` — routes for the user loop after upload.
- `src/components/play/**`, `src/components/review/**`, `src/components/flashcards/**` — session and bank UX.
- Shared persistence: **`src/lib/db/studySetDb.ts`** (read/write approved bank, drafts where the product allows), **`src/types/question.ts`** for `Question` and provenance fields used in review (e.g. `mappingMethod`, `mappingConfidence`).

**Consumes:** `Question[]`, study-set meta, session-local state. **Does not** initiate upstream vision/OCR network calls; API keys and model selection for **parsing** stay in parse/settings flows.

## Dependency direction (allowed)

- **Parse → storage → learning:** Parse pipeline writes drafts and parse progress; review approves into the bank; play/flashcards read the bank and session analytics.
- **Learning → read models:** Learning code may import **types** and **read-only helpers** on in-memory `Question` (e.g. mapping quality tier for badges) via the `src/lib/learning/**` facade where we expose them.
- **Learning must not** pull in modules whose **primary job** is to orchestrate document extraction or multimodal calls for **new** parse work.

## Forbidden imports (normative for new code)

Learning-facing UI and routes listed under **Learning / session** above **must not** import:

- `@/lib/ai/parseChunk` (and helpers that only exist to drive chunk parsing)
- `@/lib/ai/runVisionSequential`, `@/lib/ai/runOcrSequential`, `@/lib/ai/runLayoutChunkParse`
- `@/lib/ai/parseVisionPage` or other vision page drivers
- `@/lib/ai/ocrAdapter`, `@/lib/ai/renderPagesToImages` entrypoints used only for parse
- Deep `@/lib/ai/*` **orchestration** modules from components under `src/components/{play,review,flashcards}/**`

**Allowed pattern:** Import stable symbols from `@/lib/learning` (barrel), which may thin-re-export read-only helpers that still live under `src/lib/ai/` until a later split. Parse code (`AiParseSection`, etc.) may keep importing `@/lib/ai/...` directly.

**Note:** The **source** document route (`src/app/(app)/sets/[id]/source/`) is part of the **ingestion/parse story**; it may legitimately use `@/lib/ai/ocrDb` and similar. Do not treat `source` as a “learning-only” surface when applying forbidden-import rules.

## Target folder map

| Area | Role |
|------|------|
| `src/lib/ai/` | Parse domain — OCR, vision, chunk AI, policies, IDB helpers tied to parse runs |
| `src/lib/learning/` | **Stable** import surface for review/play/flashcards — start with mapping-quality re-exports |
| `src/lib/db/` | Shared persistence — both domains use it; keep transaction boundaries explicit in code reviews |
| `src/types/` | Shared contracts — `Question`, study set records |

## Relationship to Phase 15

**Phase 15** (server / background parse jobs, scale mode) can land in parallel with this boundary work. Learning features should depend on **persisted question shape** and `studySetDb` contracts, not on whether parse ran on-device or in a queue. This document is the contract learning code relies on; it is **not** blocked on Phase 15 implementation completion.

## Tooling: ESLint `no-restricted-imports` (future)

[`eslint.config.mjs`](../eslint.config.mjs) currently uses **FlatCompat** with `next/core-web-vitals` and `next/typescript` only. There are **no** per-folder `no-restricted-imports` overrides yet.

**This plan does not change ESLint.** A follow-up can add overrides for `src/components/{play,review,flashcards}/**` (and optionally learning routes) to forbid deep `@/lib/ai/*` imports except via `@/lib/learning`, **after** a baseline inventory shows zero violations (or violations are listed as tech-debt with owners).

## Product create flow vs dev OCR lab (`/dev/ocr`)

- **Learner path:** Dashboard → `/sets/new` (choose **Quiz** or **Flashcards**) → typed upload → `/sets/[id]/source` with `StudySetMeta.contentKind` set. Parse UI uses **`surface="product"`** on `AiParseSection`: OCR toggles and strategy live under **Advanced**; `OcrInspector` / `QuestionMappingDebug` stay off the page unless `?debug=1`.
- **Developer path:** **`/dev/ocr`** (and `/dev/ocr/[id]`) composes the same parse-domain components (`OcrInspector`, IDB-backed study sets) — **no second OCR engine**. In **production** builds the tree 404s unless `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB=true` (see `src/app/(app)/dev/ocr/layout.tsx`).
- **Boundary unchanged:** Learning routes still consume `Question[]` / approved bank; they do not call vision/OCR runners. Flashcard draft review (`/sets/[id]/flashcards/review`) edits the same draft store as parse output.
- **Non-goal:** Polishing the OCR lab like a consumer feature; it exists to debug OCR rows and geometry without cluttering the main create funnel.

---

## Appendix: Current `@/lib/ai` imports (Phase 16 baseline)

Commands were run from the repository root on **2026-04-11** (PowerShell / workspace search equivalent to `rg`).

### `rg "@/lib/ai" src/components/review --glob "*.{ts,tsx}"`

```
src\components\review\MappingQualityBadge.tsx
  7:} from "@/lib/ai/mappingQuality";

src\components\review\ReviewSection.tsx
  14:import { countUncertainMappings } from "@/lib/ai/mappingQuality";
```

**Interpretation:** Review UI only pulls **mapping quality** helpers from `@/lib/ai` today — no parse runners. Plan `16-02` moves these imports to `@/lib/learning` (thin re-export).

### `rg "@/lib/ai" src/components/play --glob "*.{ts,tsx}"`

```
(no matches)
```

### `rg "@/lib/ai" src/components/flashcards --glob "*.{ts,tsx}"`

```
(no matches)
```

### `rg "@/lib/ai" "src/app/(app)/sets/[id]" --glob "*.{ts,tsx}"`

```
src/app/(app)/sets/[id]/source/page.tsx
  18:import { deleteOcrResult } from "@/lib/ai/ocrDb";
```

**Interpretation:** Under `sets/[id]`, only the **source** (parse-adjacent) route imports `@/lib/ai`; play/review/flashcards/done routes do not. This matches the split above: source stays in the parse story.
