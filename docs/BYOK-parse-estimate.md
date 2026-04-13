# BYOK parse estimates (pre-run)

## Purpose

Doc2Quiz is **BYOK** (bring your own key). Users need a **rough** idea of API usage **before** they click Parse. The app must **not** call upstream APIs just to produce these numbers — estimates are derived from **metadata** (page count, strategy, toggles, stored text length) and **fixed heuristics** in code.

## Inputs

Same shape as `parseRoutePolicy` / `estimateParseRun`:

- `pageCount` — may be `null` (then a pessimistic placeholder is used; see `estimateParseRun` JSDoc).
- `parseStrategy` — `fast` | `accurate` | `hybrid`.
- `enableOcr` — affects routing vs vision-only fallback.
- `attachPageImage` — affects **vision step count** (per-page vs pair mode in `runVisionSequential`).
- `extractedTextCharCount` — length only, never raw text; feeds `decideParseRoute`.

## Vision API calls

Pages considered are **capped** at `VISION_MAX_PAGES_DEFAULT` from `renderPagesToImages` (same cap as render). Step counts mirror `runVisionSequential`:

- **Attach mode** — one vision API call per capped page.
- **Single page** (`cappedPages === 1`) — **1** call.
- **Non-attach, multi-page** — **cappedPages − 1** overlapping pair steps.

## Chunk calls

When the **layout-chunk** path is the primary intent (Fast/Hybrid with OCR on), we do **not** run OCR in the estimator. We use a **pessimistic upper bound**: at most **`min(cappedPages, 60)`** chunk-parse API calls (assumption: worst case ~one chunk per page, capped at 60). Actual chunk count comes from OCR layout and may be lower.

## Token heuristics (BYOK)

Versioned **named constants** in `src/lib/ai/estimateParseRun.ts` define rough **input** and **output** token ceilings **per** vision step and **per** chunk parse call. Totals are:

`(primary + fallback vision steps) × per-step vision constants`, and  
`chunkParseApiCallsUpperBound × per-chunk constants`.

There is **no** provider pricing, currency, or model-specific tokenizer — only order-of-magnitude hints.

## Duration heuristic

`HEURISTIC_MS_RENDER_ONCE` (2000 ms once per run), `HEURISTIC_MS_PER_VISION_STEP`, and `HEURISTIC_MS_PER_CHUNK_UPPER` approximate wall time. **Min** / **max** seconds combine render + primary path; **max** may add fallback vision steps when the happy path is chunk-first.

## Disclaimer

Estimates are not billing guarantees; actual tokens depend on your model and PDF content.
