---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Phase 09 context gathered
last_updated: "2026-04-11T18:30:00.000Z"
progress:
  total_phases: 19
  completed_phases: 17
  total_plans: 39
  completed_plans: 38
  percent: 97
---

# Doc2Quiz — State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-05)

**Core value:** The practice loop must feel faster and more effective than reading the PDF directly.
**Current focus:** Phase 18 complete (`parseScore` doc + types + `deriveParseScores`); next open work per `ROADMAP.md` (e.g. Phase 14, 6, 9).

## Current Status

- Phase 1 (PDF Ingestion): Complete
- Phase 2 (AI Question Parsing): Complete
- Phase 3 (Question Review): Complete
- Phase 4 (Practice Engine): Complete
- Phase 5 (Score & Repeat): Complete
- Phase 6 (Pipeline Hardening & Observability): In progress (see 06-CONTEXT)
- Phase 7 (Layout-aware chunk parsing): Complete — `07-01-SUMMARY.md`, `07-02-SUMMARY.md`

## Last Session

**Stopped at:** Phase 09 context gathered
**Date:** 2026-04-11
**Resume file:** .planning/phases/09-9/09-CONTEXT.md

## Accumulated Context

### Roadmap Evolution

- Phase 19 execute (`/gsd-execute-phase 19`): `forwardSettings.ts`, `parseCapabilities.ts`, `pipelineStageRetry.ts`, storage bridge, settings 3-field form, `AiParseSection` capability gating, OCR/parse/IDB retries, `parseChunk` OpenAI-compat-only, WORKFLOW + `docs/BYOK-forward-only.md`; `19-01-SUMMARY.md`, `19-02-SUMMARY.md`; roadmap Phase 19 → **Complete** (sau plan `19-CONTEXT` / `19-01` / `19-02`).
- Phase 19 added: **Stage-specific retry policy** (OCR / parse / validation / mapping / persistence — không gộp một kiểu retry); **capability matrix** provider × mode (tránh lỗi muộn như vision + Anthropic native); **BYOK tối giản** — bỏ GPT / Anthropic / Custom, chỉ **ba trường nhập** một đường OpenAI-compatible (`/gsd-add-phase`).
- Phase 17 execute (`/gsd-execute-phase 17`): `estimateParseRun.ts`, `docs/BYOK-parse-estimate.md`, `AiParseEstimatePanel.tsx`, `AiParseSection` wiring; `17-01-SUMMARY.md`, `17-02-SUMMARY.md`; roadmap Phase 17 marked complete + coverage row.
- Phase 18 plan (`/gsd-plan-phase 18`): `18-01-PLAN.md`, `18-02-PLAN.md`, `18-VALIDATION.md` — PARSE-SCORE doc + `parseScore` types + `deriveParseScores`; plan-checker passed; research off; Nyquist via `18-VALIDATION.md`.
- Phase 18 execute (`/gsd-execute-phase 18`): `docs/PARSE-SCORE-contract.md`, `src/types/parseScore.ts`, `src/lib/ai/deriveParseScores.ts`, `mappingQuality.ts` re-exports; `18-01-SUMMARY.md`, `18-02-SUMMARY.md`; roadmap Phase 18 → **Complete**.
- Phase 18 added: **parseScore contract** — schema chính thức (structure quality, provenance quality, OCR confidence, retry history); tách `ocrQuality` vs `questionQuality`; không gộp “trang OCR tốt” với “câu hỏi tốt” (`/gsd-add-phase`).
- Phase 17 plan (`/gsd-plan-phase 17`): `17-01-PLAN.md`, `17-02-PLAN.md` — `estimateParseRun` + BYOK doc + estimate panel (`aria-live`); tokens upper-bound heuristics; Nyquist skipped (research off).
- Phase 17 added: BYOK — ước lượng cost/time (call/token/page) **trước** khi parse; UI estimate + công thức từ metadata, không gọi API để đo (`/gsd-add-phase`).
- Phase 16 execute (`/gsd-execute-phase 16`): `docs/ARCHITECTURE-domain-boundaries.md`, `src/lib/learning/*`, review imports → `@/lib/learning`; `16-01-SUMMARY.md`, `16-02-SUMMARY.md`; `phase complete 16` (roadmap checkboxes + coverage row normalized manually).
- Phase 16 plan (`/gsd-plan-phase 16`): `16-01-PLAN.md`, `16-02-PLAN.md` — architecture doc + `@/lib/learning` facade for review mapping; research off; plan-checker passed; Nyquist/VALIDATION skipped (no RESEARCH).
- Phase 16 added: Tách rõ "domain học tập" khỏi "domain parse tài liệu" — boundary ingestion/parsing vs learning/session analytics; giảm coupling feature học với OCR/vision (`/gsd-add-phase`).
- Phase 15 added: Server/background worker mode — PDF render + parse queue khỏi client khi scale (client-heavy: pdf.js, IDB, OCR/vision orchestration); tùy chọn opt-in, giữ local path (`/gsd-add-phase`).
- Phase 15 plan (`/gsd-plan-phase 15`): `15-01-PLAN.md`, `15-02-PLAN.md` — scale-mode doc + types + env + `/api/parse-jobs` stubs; Nyquist skipped (research off); no UI-SPEC (infra-first).
- Phase 15 execute: scale-mode doc + `parseJob` types + `serverParse/env` + `/api/parse-jobs` route stubs (`15-01-SUMMARY.md`, `15-02-SUMMARY.md`); `phase complete 15`.
- Phase 12 execute: `parseRoutePolicy.ts` + `AiParseSection` / `AiParseParseStrategyPanel` wiring (`12-01-SUMMARY.md`, `12-02-SUMMARY.md`); `phase complete 12`.
- Phase 14 discuss (`/gsd-discuss-phase 14`): `14-CONTEXT.md` — D-01..D-10: bỏ catch rỗng quanh `applyQuestionPageMapping` (vision), toast + summary khi uncertain/unresolved, chip review, ngưỡng confidence ~0.45, cập nhật WORKFLOW doc; không chặn persist (session không chọn gray area — defaults khóa theo audit code).
- Phase 14 plan (`/gsd-plan-phase 14`): `14-01-PLAN.md`, `14-02-PLAN.md`, `14-UI-SPEC.md` — plan-checker fixes: `depends_on: ["14-01"]`, `QuestionPreviewList` cho D-06, task D-03 OCR toast, `npm run build` cuối mỗi wave.
- Phase 14 added: **Page mapping & provenance quality** — không nuốt lỗi mapping best-effort mà không nâng cảnh báo; cờ chất lượng / độ tin cậy câu hỏi; draft lưu với page link không chắc phải **gắn nhãn** rõ, tránh dữ liệu “có vẻ ổn” nhưng provenance sai (`/gsd-add-phase`).
- Phase 13 added: Monitoring & error reporting / pipeline observability — beyond local `pipelineLog`; remote shipping (Sentry, OTel, or log drain), stage-tagged errors for PDF render vs OCR vs vision vs mapping vs persistence; roadmap cleaned + dir `13-monitoring-error-reporting-observability` (`/gsd-add-phase`).
- Phase 12 added: Hợp nhất chiến lược parse text/OCR/vision thành một engine rõ ràng; nối text pipeline vào UI parse chính; policy chọn mode theo loại tài liệu (`/gsd-add-phase`).
- Phase 12 plan (`/gsd-plan-phase 12`): `12-01-PLAN.md` (pure `parseRoutePolicy.ts`), `12-02-PLAN.md` (IDB `getDocument` + policy logs + strategy panel hint); Nyquist skipped (research off in config); UI-SPEC not generated — engine-first scope.
- Phase 10 plan (`/gsd-plan-phase 10`): `10-01-PLAN.md` — verify/harden vision staging (POST `Cache-Control`, README TTL/abuse notes, `10-01-SUMMARY.md`); checker passed; Nyquist skipped (research off).
- Phase 11 added: Split `AiParseSection` — orchestration hook + parse state machine + presenter components (avoid god-component: OCR, chunks, vision fallback, progress in one file). Roadmap entry cleaned + phase dir renamed to `11-split-aiparsesection-orchestration` (`/gsd-add-phase`).
- Phase 10 added: Persistent vision staging — replace in-memory vision staging with object storage or signed URLs so serverless multi-instance deploys do not lose staged images between POST and upstream GET (`/gsd-add-phase`).
- Phase 7 added: Layout-aware chunk-based parsing (token-optimized) — OCR blocks → semantic chunks → per-chunk text AI parse → merge; full-page vision as fallback; see `07-CONTEXT.md`.
- Phase 7 discuss (`/gsd-discuss-phase 7`): gray areas closed in `07-CONTEXT.md` (D-16–D-26: OCR prereq, providers, sort key, hybrid threshold 85%, bulk fallback rules, Question optional fields, debug UI).
- Phase 7 plan (`/gsd-plan-phase 7`): `07-01-PLAN.md`, `07-02-PLAN.md` added — ready for `/gsd-execute-phase 7` or manual execution.
- Phase 9: **Math & notation preview (LaTeX-first)** — roadmap goal/deliverables set; math-first MCQ + preview; other subjects reuse notation layer when still formula/LaTeX; `docs/NOTES-latex-math-rendering.md` extended with stack comparison table.

## Config

- Mode: YOLO
- Granularity: Standard
- Parallelization: Parallel
- Research agents: Off
- Plan check: On
- Verifier: Off
- Model profile: Balanced
