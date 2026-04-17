---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 30
current_plan: 2
status: Ready to execute
stopped_at: Completed 30-01-PLAN.md
last_updated: "2026-04-17T18:32:25.025Z"
progress:
  total_phases: 38
  completed_phases: 27
  total_plans: 64
  completed_plans: 61
  percent: 95
---

# Doc2Quiz — State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-05)

**Core value:** The practice loop must feel faster and more effective than reading the PDF directly.
**Current focus:** Phase 30 — replace-page-level-chunking-with-layout-aware-chunking

## Execution Progress

**Current Phase:** 30
**Current Plan:** 2
**Total Plans in Phase:** 3

## Current Status

- Phase 1 (PDF Ingestion): Complete
- Phase 2 (AI Question Parsing): Complete
- Phase 3 (Question Review): Complete
- Phase 4 (Practice Engine): Complete
- Phase 5 (Score & Repeat): Complete
- Phase 6 (Pipeline Hardening & Observability): In progress (see 06-CONTEXT)
- Phase 7 (Layout-aware chunk parsing): Complete — `07-01-SUMMARY.md`, `07-02-SUMMARY.md`
- Phase 20 (AI-first create, quiz vs flashcards, product parse chrome): Complete — `20-01-SUMMARY.md`, `20-02-SUMMARY.md`
- Phase 21 (Vision-first MVP batch pipeline): Complete — `21-01-SUMMARY.md`, `21-02-SUMMARY.md`
- Phase 22 (Mint UI/UX from `example/`): Complete — wave 0 (tokens/shell) prior session; waves 1–2 (`22-01` dashboard + stats, `22-02` settings + source/review headers); `22-01-SUMMARY.md`, `22-02-SUMMARY.md`
- Phase 23 (full layout from `example/`): Complete — `/develop`, `mockAllowlist`, `/api/develop/mock/[slug]`, `DevelopLabClient`, dev Command Palette; inventory §8 + play outer chrome; `23-01-SUMMARY.md`, `23-02-SUMMARY.md`.
- Phase 24 (vision parse fewer round-trips): Complete — `24-01-SUMMARY.md`, `24-02-SUMMARY.md`.
- Phase 27 (Preview-first parsing while full upload continues): Complete — `27-01-SUMMARY.md`, `27-02-SUMMARY.md`, `27-03-SUMMARY.md`.

## Last Session

**Stopped at:** Completed 30-01-PLAN.md
**Date:** 2026-04-17
**Resume file:** None

## Accumulated Context

### Roadmap Evolution

- Phase 27 execute (2026-04-17): preview-first create flow per `27-CONTEXT.md`; `27-01`..`27-03` SUMMARYs; `npm run lint` + `npm run build` green; roadmap Phase 27 → **Complete** (3/3 plans).
- Phase 26 plan `26-01` execute (2026-04-17): UPLOAD-01..03,05,06 captured in requirements + roadmap; shipped `src/types/uploads.ts`, `src/lib/uploads/pdfUpload*.ts`, `/api/uploads/pdf/{init,part,complete,abort}` with HMAC finalize token + `uploadCapability` gating; `npm run lint` + `npm run build` green; `26-01-SUMMARY.md`. **UPLOAD-04** remains for `26-02` (progress/cancel UX).
- Phase 24 execute (`/gsd-execute-phase 24`, 2026-04-13): shipped `planVisionBatches` + `runVisionBatchSequential` defaults + legacy fallback + strict `sourcePages` + `AiParseSection` `onBatchPlanResolved`; `npm run lint` + `npm run build` green; roadmap Phase 24 → **Complete**; `24-01-SUMMARY.md`, `24-02-SUMMARY.md`.
- Phase 24 added + planned (`/gsd-add-phase`, 2026-04-13): **Vision parse: fewer round-trips — single request or max-window batches when within provider limits**; dir `.planning/phases/24-vision-parse-fewer-round-trips-single-request-or-max-window-/`; artifacts `24-CONTEXT.md`, `24-01-PLAN.md`, `24-02-PLAN.md`; roadmap Phase 24 → **Planned**; depends Phase 21.
- Phase 25 added: Skip rasterization for born-digital PDFs; extract text layer first
- Phase 26 added: Direct multipart/resumable upload to object storage
- Phase 27 added: Preview-first parsing while full upload continues
- Phase 28 added: Move image preprocessing into Web Workers
- Phase 29 added: Route by page type: text page vs bitmap page vs rich layout page
- Phase 30 added: Replace page-level chunking with layout-aware chunking
- Phase 31 added: Cache prompt prefixes, embeddings, and content hashes
- Phase 32 added: Use draft-pass generation plus validator-pass rewrite
- Phase 33 added: Adopt a vector store matched to your scale
- Phase 34 added: Add async workers / task queue for full indexing
- Phase 35 added: Tune OCR preprocessing: thresholding, downsample huge pages, 300-DPI target
- Phase 36 added: Queue-based fallback to high-accuracy pipeline only on uncertain docs
- Phase 37 added: Global transfer acceleration / edge ingress
- Phase 38 added: Full fine-tuning or distillation for quiz style
- Phase 23 execute (`/gsd-execute-phase 23`, 2026-04-12): shipped wave 1+2 per plans; `npm run lint` + `npm run build` green; roadmap Phase 23 + coverage → **Complete**.
- Phase 23 plan (`/gsd-plan-phase 23`, 2026-04-12): `23-UI-SPEC.md`, `23-01-PLAN.md` (wave 1 `/develop` + Sheet + mock API + Command Palette dev), `23-02-PLAN.md` (wave 2 inventory + play outer chrome); research skipped (config); Nyquist/VALIDATION skipped (no RESEARCH); roadmap Phase 23 → **Planned**; `state planned-phase` (2 plans); user addendum: shadcn chrome + wrap `example/` for bugfix workflow.
- Phase 23 added (`/gsd-add-phase`): **Replace entire app layout with code ported from `example/`** (full layout parity vs incremental Mint tweaks); English description for tooling; user intent: *replace toàn bộ layout với code từ example*; dir `.planning/phases/23-replace-entire-app-layout-with-code-ported-from-example-full/`.
- Phase 22 added (`/gsd-add-phase`): **Implement example Mint UI/UX** — palette + fonts + shell từ `example/` vào Next; tiếp tục parity theo từng page; dir `.planning/phases/22-implement-example-mint-ui-ux-into-main-app-dashboard-shell-t/`, `22-CONTEXT.md`.
- Phase 22 plan (`/gsd-plan-phase 22`): `22-RESEARCH.md`, `22-UI-SPEC.md`, `22-01-PLAN.md` (wave 1 dashboard), `22-02-PLAN.md` (wave 2 settings + headers); roadmap Phase 22 → **Planned**; Nyquist/VALIDATION skipped (research disabled in config).
- Phase 22 execute (autonomous slice, 2026-04-12): implemented `22-01` + `22-02` — `DashboardLibraryClient`, `DashboardStatsWidget`, `dashboard/page.tsx`, `settings/page.tsx`, `AiProviderForm`, `sets/[id]/source` + `review` headers; `22-01-SUMMARY.md`, `22-02-SUMMARY.md`; roadmap Phase 22 + coverage row → **Complete**; `npm run lint` + `npm run build` green.
- Phase 20 research (`/gsd-research-phase 20`): `20-RESEARCH.md` — funnel routes, `surface` vs `variant`, source siblings, IDB `contentKind` without DB_VERSION bump unless stores change, `/dev/ocr` compose-only, flashcard redirect pitfall, Suspense+`useSearchParams` precedent.
- Phase 20 plan (`/gsd-plan-phase 20`): `20-UI-SPEC.md`, `20-01-PLAN.md` (wave 1 funnel + `contentKind`), `20-02-PLAN.md` (wave 2 product parse chrome + `/dev/ocr` + flashcards review stub); plan-checker warnings addressed; roadmap + coverage row Phase 20 → **Planned**; `state planned-phase` (2 plans).
- Phase 20 execute (`/gsd-execute-phase 20`): funnel `/sets/new` → `/sets/new/quiz` | `/sets/new/flashcards`, `StudySetMeta.contentKind`, `NewStudySetPdfImportFlow`, `AiParseSection` `surface` + source `?debug=1`, `/dev/ocr` lab (env-gated prod), `/sets/[id]/flashcards/review`, `ParseResultOverlay.continueLabel`, architecture doc subsection; `20-01-SUMMARY.md`, `20-02-SUMMARY.md`; roadmap Phase 20 → **Complete**.
- Phase 21 added (`/gsd-add-phase`): **Vision-first MVP pipeline** — batch vision 10+overlap2, explicit `ParseOutputMode` (quiz vs flashcard, fix cross-mode bug), incremental preview, confidence, structured pipeline logs, batch fingerprint cache, benchmark per parse, dedupe; OCR off MVP default path; optional ensemble hook; PRD in `21-CONTEXT.md`; dir `.planning/phases/21-vision-first-mvp-pipeline-10-page-batch-vision-overlap-expli/`.
- Phase 21 plan (`/gsd-plan-phase 21`): `21-RESEARCH.md`, `21-UI-SPEC.md`, `21-VALIDATION.md`, `21-01-PLAN.md` (wave 1 lib/types/cache/benchmark/log), `21-02-PLAN.md` (wave 2 runner + `AiParseSection` + persistence + docs); roadmap Phase 21 → **Planned**; `total_plans` 43 (two open plans).
- Phase 20 added: **AI-first content creation** — chọn đầu ra Quiz vs Flashcards từ dashboard; upload + AI parse + review theo `contentType`; ẩn OCR/parse jargon khỏi main UX; **OCR dev-only route** tái dùng parse domain; giữ boundary parse vs learning; không phá engine (`/gsd-add-phase`).
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

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Date |
| ----: | ---: | -------- | ----: | ----: | ---- |
| 28 | 02 | 20m | 2 | 1 | 2026-04-17 |
| 29 | 01 | 30m | 2 | 4 | 2026-04-18 |
| 29 | 02 | ~45m | 2 | 2 | 2026-04-18 |

## Config

- Mode: YOLO
- Granularity: Standard
- Parallelization: Parallel
- Research agents: Off
- Plan check: On
- Verifier: Off
- Model profile: Balanced
