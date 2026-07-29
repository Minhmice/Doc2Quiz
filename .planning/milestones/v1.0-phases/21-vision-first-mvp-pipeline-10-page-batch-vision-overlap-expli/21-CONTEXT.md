# Phase 21 — Context (PRD)

**Source:** System instruction — Refactor Doc2Quiz vision pipeline for MVP (2026-04-11).

## Objective

Vision-first MVP: **100% vision** on the active path; **remove OCR** from default runtime (keep code, dev-only). Replace **2-page pair** primary path with **10-page batches + 2-page overlap**. Add **incremental preview**, **per-item confidence**, **centralized structured logging**, **page-batch fingerprint cache**, **compressed prompts**, **benchmark after each parse**, hook for **optional multi-model ensemble** (flagged off). **Fix release-blocking bug:** Flashcard flow must not produce Quiz-shaped output.

## Non-goals (MVP)

- OCR, layout OCR chunking, OCR fallback, hybrid OCR/vision routing, deep semantic graphs, advanced post-edit.

## Architecture highlights

### Batching

- `PageBatch`: `batchIndex`, `startPage`, `endPage`, `pageIndexes[]`, `pages[]`.
- `buildVisionBatches(pages, batchSize=10, overlap=2)` — no skipped pages; deterministic overlap; last batch ≤10.
- Example 20 pages: [1–10], [9–18], [17–20].

### Core runner

- `runVisionBatchSequential()` — iterate batches, cache check, vision API (≤10 images/request), parse JSON, **onItemsExtracted** incremental callback, score, log, accumulate benchmark, dedupe merge, persist.

### Prompts

- `buildVisionSystemPrompt(mode: "quiz" | "flashcard"): string` — short, stable.
- `buildVisionUserPrompt({ mode, startPage, endPage, totalPages }): string` — batch delta + schema reminder.
- OpenAI-compatible `chat/completions` multimodal; retry without `response_format` on 400 if needed.

### Mode separation (critical)

- `ParseOutputMode = "quiz" | "flashcard"` explicit end-to-end (no inference from legacy only).
- Types: `QuizQuestion`, `FlashcardItem`, union `VisionParseItem`.
- `parseVisionQuizResponse` / `parseVisionFlashcardResponse`; separate validators.
- Persistence: `putDraftQuizItems` / `putDraftFlashcardItems` or unified store with explicit `kind` — **no coercion** flashcard → quiz.

### Incremental UI

- `onItemsExtracted(items, batchMeta)` — append draft after each successful batch; dedupe overlap for display order.

### Confidence [0,1]

- Heuristics: completeness, 4 options, indices, length thresholds; flashcard front/back; duplicates — `computeQuizConfidence` / `computeFlashcardConfidence`.

### Logging

- Structured `pipelineLog({ stage, mode, batchIndex, ... })` — stages include: `parse_start`, `render_pages_*`, `batch_*`, `batch_stream_append`, `dedupe_*`, `persist_*`, `parse_done`, `benchmark_ready`.

### Cache

- `hashVisionBatch(pages, mode)` → key; hit = reuse parse; log `batch_cache_hit`; UI still streams cached rows.

### Benchmark (mandatory per parse)

- `VisionParseBenchmark` — pages, batches, items, latency, **estimated** tokens (document approximation), cache hits/misses, naive baseline (e.g. old pair count) vs actual requests, `requestReductionRatio`, per-batch rows, confidence summary (high/medium/low). Log + optional IDB attach to run.

### Dedupe

- Mode-aware: quiz by normalized stem; flashcard by normalized front (+ optional front+back).

### Ensemble (Phase 2 prep)

- `VisionModelConfig[]` behind flag; when on: dual model, merge, prefer higher confidence on conflict — **not default**.

### Image constraints

- Keep bounded width / JPEG quality; do not inflate payload for 10 images.

## Acceptance criteria (release)

1. Primary path = batch vision (not pair).
2. Quiz vs flashcard correct + persisted + reopen preserves mode.
3. Progressive list updates during parse.
4. Confidence on each item; UI can flag low confidence.
5. Structured logs; cache mode-aware; benchmark every parse.
6. No MVP dependence on OCR default path.

## Canonical module targets (from PRD)

`visionBatching.ts`, `visionPrompts.ts`, `runVisionBatchSequential.ts`, quiz/flashcard parsers & validators, `visionConfidence.ts`, `visionParseCache.ts`, extend `pipelineLogger.ts`, `visionBenchmark.ts`, mode-aware draft persistence.

## Migration

- Short note for users with old drafts: single `Question[]` store vs new split — plan in execute wave.
