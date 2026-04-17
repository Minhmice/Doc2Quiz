# Phase 17 — Plan 17-01 summary

**Wave:** 1 (deterministic estimator + operator doc)

## Delivered

- `docs/BYOK-parse-estimate.md` — Purpose, inputs, vision/chunk call formulas, token and duration heuristics, disclaimer sentence aligned with code.
- `src/lib/ai/estimateParseRun.ts` — Pure `estimateParseRun` + `visionStepsFullRun`, `ParseRunEstimateInput` / `ParseRunEstimate`, exported heuristic constants, `PARSE_RUN_ESTIMATE_DISCLAIMER`, integration with `decideParseRoute` and `VISION_MAX_PAGES_DEFAULT`.

## Verification

- `npm run lint` and `npm run build` succeeded after full phase wiring (see 17-02-SUMMARY for UI).
