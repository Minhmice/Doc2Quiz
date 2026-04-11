# parseScore — official contract

**parseScoreSchemaVersion:** `1` (see `PARSE_SCORE_SCHEMA_VERSION` in `src/types/parseScore.ts`)

This document defines **structured** parse-quality signals for Doc2Quiz. It is the human-readable companion to `src/types/parseScore.ts`. Scores are **derived views** of persisted parse artifacts — not billing anchors, not crypto proofs, and **not** a substitute for human review when content matters.

---

## 1. Versioning

- **`parseScoreSchemaVersion`** is a monotonically increasing integer (starts at **1**).
- **Bump** the version when you make a **breaking** change to exported contract shapes (field rename/removal, semantic change of a field, or merging dimensions that were previously separate).
- **Non-breaking** additions (new optional fields, new `ParseRetryReasonCode` literals) may stay on the same version if all consumers tolerate `undefined` / unknown enum values; otherwise bump and document migration in this file.

---

## 2. Goals

The contract standardizes:

1. **Structure quality** — Was the MCQ shape valid after LLM parse (options, correct index)?
2. **Provenance quality** — How trustworthy is page / pipeline linkage (`mappingMethod`, confidence, region flags)?
3. **OCR pipeline / page quality** — Per-page OCR outcome, block geometry/confidence rollups, region verification — **without** judging question stems.
4. **Retry history** — Append-style record of retry-worthy events (`phase`, `reasonCode`, optional time/detail).

Consumers (review, preview, estimate panel copy, future dashboards) should read **objects with named dimensions**, not one opaque “quality number.”

---

## 3. Non-goals (normative)

- **never merge** OCR page/pipeline quality with post-parse MCQ / **questionQuality** into **one scalar** (no `overallQuality`, no `mergedScore`).
- Phase 18 **does not** change review **badge** behavior (`getMappingQualityTier` in `mappingQuality.ts` remains the compact UX).
- Phase 18 **does not** require Phase 17 estimate UI; estimate panels may **later** read the same DTOs.
- Full **ParseRetryHistory** persistence may land in Phase 19+; the contract **must** allow **`ParseRetryHistory` with zero events** today.
- Do **not** invent new localStorage / IDB key names in this doc — only map to **existing** persisted fields.

---

## 4. `ocrQuality` vs `questionQuality`

### 4.1 `ocrQuality` (page / run — OCR only)

Signals come **only** from OCR artifacts:

- `OcrPageResult.status`, `warnings`, `invalidBlockCount`
- Per-block `OcrBlock.confidence` (aggregate min/mean/median in derived views)
- `OcrPageResult.regionVerification` (`cropReadyBlockCount`, `pageUsableForCrop`, block verdicts)
- Run-level `OcrRunResult.stats` (`successPages`, `failedPages`, `totalBlocks`, …)

A page can show **strong OCR geometry and confidence** and still produce a **bad MCQ** (garbled stem, wrong mapping). **ocrQuality** must never be interpreted as “question is good.”

### 4.2 `questionQuality` (post-parse MCQ — question only)

Signals come from **`Question`** (and LLM parse metadata on it), **not** from raw OCR block lists:

- **Structure:** `parseStructureValid`, four options present, `correctIndex` in range
- **Provenance:** `mappingMethod`, `mappingConfidence`, `mappingReason`, `verifiedRegionAvailable`, page indices
- **Model parse confidence:** `parseConfidence` — **LLM / extraction** confidence, **not** OCR block confidence

---

## 5. Schema overview (matches `src/types/parseScore.ts`)

- **`OcrPageQuality`** — One page’s OCR-side rollup (status, block stats, optional region summary).
- **`OcrRunQuality`** — Run wrapper: `schemaVersion`, `pages[]`, optional `stats` (`OcrRunStats`).
- **`QuestionStructureQuality`** — MCQ shape validity facets.
- **`QuestionProvenanceQuality`** — Mapping / page-link facets only.
- **`QuestionParseQuality`** — `{ structure, provenance, modelParseConfidence? }` — **two** sub-objects, not one merged score.
- **`ParseRetryEvent`** / **`ParseRetryHistory`** — `events` may be empty; each event has `phase`, `reasonCode`, optional `at`, `detail`.

---

## 6. Mapping table (contract → persisted types)

| Contract concept | Source type | Source field(s) | Notes |
|------------------|-------------|-----------------|-------|
| `QuestionParseQuality.structure` | `Question` | `parseStructureValid`; `options` length; `correctIndex` | Derived in code; stem text quality out of scope |
| `QuestionParseQuality.provenance` | `Question` | `mappingMethod`, `mappingConfidence`, `mappingReason`, `verifiedRegionAvailable`, `sourcePageIndex`, `ocrPageIndex`, `layoutChunkId` | No OCR block `confidence` here |
| `QuestionParseQuality.modelParseConfidence` | `Question` | `parseConfidence` | LLM parse only |
| `OcrPageQuality` (per page) | `OcrPageResult` | `pageIndex`, `status`, `blocks`, `regionVerification`, `invalidBlockCount`, `warnings` | Default `status` in derivation when missing — see `deriveParseScores` JSDoc |
| `OcrRunQuality.stats` | `OcrRunResult` | `stats?: OcrRunStats` | Optional passthrough |
| Retry `phase` vocabulary | `ParseProgressRecord` | `phase: ParseProgressPhase` | Today only **latest** phase on record; **no** append-only log in IDB yet → `ParseRetryHistory.events` often `[]` |
| Retry events (future) | *(future store)* | — | Contract ready for Phase 19 persistence |

Rows for source types **Question** and **OcrPageResult** are explicit in the table above (`Question` …, `OcrPageResult` …).

---

## 7. Relationship to `mappingQuality.ts`

Badges (`MappingQualityTier`, `getMappingQualityTier`, uncertain counts) remain the **compact** review UX. **`parseScore` subsumes richer dimensions** for tooling, summaries, and future UI. Phase **18-02** may re-export derivation helpers from `mappingQuality.ts` **without** changing tier predicate order or thresholds.

---

## 8. Domain placement

- Types: `src/types/parseScore.ts`
- Derivation: `src/lib/ai/deriveParseScores.ts` (parse domain per `docs/ARCHITECTURE-domain-boundaries.md`)
- Learning routes may later import **DTOs** via `@/lib/learning` — not part of Phase 18 execution scope.

---

## References

- `docs/ARCHITECTURE-domain-boundaries.md`
- `src/types/question.ts`, `src/types/ocr.ts`, `src/types/studySet.ts`
- `src/lib/ai/mappingQuality.ts`
