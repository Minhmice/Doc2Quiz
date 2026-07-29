---
phase: 2
slug: input-markitdown
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-25
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm test -- --run && npm run typecheck && npm run build` |
| **Estimated runtime** | ~90 seconds |

## Sampling Rate

- **After every task commit:** `npm run typecheck`
- **After every plan wave:** `npm test -- --run`
- **Phase gate:** `npm run build` + manual ingest smoke (file + paste + URL)

## Per-Task Verification Map

| Task area | Requirement | Test Type | Automated Command | Status |
|-----------|-------------|-----------|-------------------|--------|
| Validation enforcement | INPUT-VAL-01 | unit | `npm test -- --run validation` | ⬜ |
| MarkItDown converter | CONV-01 | unit/integration | `npm test -- --run markitdown` | ⬜ W0 |
| Ingest API | INPUT-01–12, CONV-02 | integration | `npm test -- --run ingest` | ⬜ W0 |
| Input zone UI | INPUT-* | manual | Browser smoke checklist | ⬜ |

## Wave 0 Gaps

- [ ] `src/lib/pipeline/markitdown.test.ts` — mock subprocess, assert markdown output shape
- [ ] `src/app/api/study-sets/[id]/ingest/route.test.ts` — validation 4xx before side effects
- [ ] Manual ingest smoke: PDF upload → raw_markdown in DB

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Steps |
|----------|-------------|------------|-------|
| File upload all formats | INPUT-01–10 | Needs real files + Python | Upload sample PDF/DOCX → verify raw MD |
| YouTube URL | INPUT-12 | Network + MarkItDown | Submit URL → verify transcript section in raw MD |
| Storage original preserved | CONV-02 | Supabase Storage | Check bucket object after file ingest |

## Validation Sign-Off

- [x] `nyquist_compliant: true` in frontmatter
- [ ] Wave 0 tests created during execution

**Approval:** pending
