# Phase 18 — Plan 01 Summary

**Executed:** 2026-04-11

## Deliverables

- **`docs/PARSE-SCORE-contract.md`** — Versioning, goals, **Non-goals**, **`ocrQuality` vs `questionQuality`**, schema overview, mapping table (`Question` / `OcrPageResult` rows), **`ParseRetryHistory`**, **never merge**, `mappingQuality` relationship, domain placement.
- **`src/types/parseScore.ts`** — `PARSE_SCORE_SCHEMA_VERSION`, `OcrPageQuality`, `OcrRunQuality`, `QuestionStructureQuality`, `QuestionProvenanceQuality`, `QuestionParseQuality`, `ParseRetryEvent`, `ParseRetryHistory`, `ParseRetryPhase`, `ParseRetryReasonCode`.

## Verification

- `npm run lint` — pass on changed files (`deriveParseScores` / `parseScore` / `mappingQuality` subset); full-project lint may show pre-existing warnings elsewhere.
- `npm run build` — run in wave 2 after `deriveParseScores`; wave 1 doc+types typecheck via wave 2 build.

## Requirement trace

| ID | Evidence |
|----|----------|
| Phase 18 goal | Doc + types separate OCR run/page signals from question structure/provenance; no merged scalar. |
