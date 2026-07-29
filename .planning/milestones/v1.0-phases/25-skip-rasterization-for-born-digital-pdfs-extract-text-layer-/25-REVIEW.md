---
phase: 25-skip-rasterization-for-born-digital-pdfs-extract-text-layer-
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/pdf/sampleTextLayerSignal.ts
  - src/lib/ai/parseRoutePolicy.ts
  - src/components/ai/AiParseSection.tsx
  - src/components/ai/AiParseParseStrategyPanel.tsx
  - src/lib/ai/chunkText.ts
  - src/lib/ai/runSequentialParse.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: needs_fix
---

## Summary

Phase 25’s intent (sampled numeric text-layer signal + policy reason codes + quiz text-first lane with deterministic quality gate + vision fallback) is generally implemented in a safe way (no raw PDF text in logs, sampling is capped, and uncertain defaults to vision via policy).

One functional UX bug remains: during the **quiz text-first** path (`parseMode === "chunk"`), the progress label still shows **vision** messaging because it branches on `parseOutputMode === "quiz"` before checking `parseMode`.

## Warnings

### WR-01: Text-first quiz lane shows “Parsing with vision…” progress label

**File:** `src/components/ai/AiParseSection.tsx:2648-2686` and `src/components/ai/AiParseSection.tsx:2673-2696`

**Issue:**
When Phase 25 routes quiz to the text-first lane, `parseMode` is set to `"chunk"` (see `runUnifiedParseInternal`), but the progress UI label uses:

- `isProductSurface || parseOutputMode === "quiz" ? "Parsing with vision…"` …

This causes the UI to incorrectly claim the app is parsing with vision while it is actually doing a sequential text-chunk run, which is confusing and undermines the “skipping page images” promise.

**Fix:**
Reorder the progress-label conditionals so they **prioritize `parseMode`** (and/or `visionRendering`) over `parseOutputMode`.

Concretely, in both progress blocks:
- Check `visionRendering` first (already done)
- Then check `parseMode === "chunk"` and display a text-first label (e.g. `Text parse…` or `Text chunks…`)
- Then fall back to the existing quiz/vision wording

Example sketch:

```ts
visionRendering
  ? "Rendering PDF pages as images…"
  : parseMode === "chunk"
    ? `Parsing text… ${progress.current} / ${progress.total}`
    : isProductSurface || parseOutputMode === "quiz"
      ? `Parsing with vision… ${progress.current} / ${progress.total} steps`
      : /* existing branches */
```

## Info

### IN-01: `sampleTextLayerSignal` uses pdf.js without explicit cancel hook

**File:** `src/lib/pdf/sampleTextLayerSignal.ts:87-136`

**Issue:**
The helper respects `AbortSignal` checks between major steps, but pdf.js itself isn’t passed an abort/cancel signal (pdf.js has its own cancellation mechanisms).

**Fix:**
Optional hardening: if pdf.js supports cancellation in your current `pdfjs-dist` version, wire it so abort can stop in-flight work earlier. If not, current behavior is acceptable given sampling is capped to ≤5 pages.

### IN-02: Policy sampled-signal “uncertain” doesn’t carry an explicit uncertain code inside `text.reasonCodes`

**File:** `src/lib/ai/parseRoutePolicy.ts:61-85`

**Issue:**
When `textLayerSignal` exists but `sampledPages <= 0`, `classifyTextLayerSignal` returns `kind: "uncertain"` with only `[TEXT_LAYER_SAMPLED_FIRST_PAGES]` in `reasonCodes`; the explicit uncertain code is added later by `decideParseRoute` in the strategy branches. This is correct today but a little easy to misuse if future callers rely on `text.reasonCodes` directly.

**Fix:**
Consider including `TEXT_LAYER_UNCERTAIN_DEFAULT_VISION` in `reasonCodes` for the `sampledPages <= 0` “uncertain” return to make the classification output self-describing.

---

_Reviewer: Claude (gsd-code-reviewer)_
