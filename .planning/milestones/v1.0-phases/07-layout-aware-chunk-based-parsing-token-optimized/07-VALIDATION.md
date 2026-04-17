---
phase: "07"
slug: layout-aware-chunk-based-parsing-token-optimized
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 07 — Validation Strategy

> Nyquist / execution sampling contract for layout-aware chunk parsing, timing (D-27–D-29), and parse UI. Aligns with `07-RESEARCH.md` **Validation architecture** and phase plans `07-01-PLAN.md`, `07-02-PLAN.md`.

---

## Validation Architecture

| Property | Value |
|----------|-------|
| **Framework** | None in repo — `package.json` has no `test` script; Wave 0 optional Vitest (deferred). |
| **Config file** | `eslint.config.mjs` + TypeScript project references |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint` && `npm run build` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task:** `npm run lint`
- **After each plan wave (01 then 02):** `npm run build`
- **Before UAT / verify-work:** Full suite green; manual parse smoke on `/sets/[id]/source` (Fast + Accurate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure behavior | Test type | Automated command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 07-01-01 | 01 | 1 | AI-02, AI-03 | T-07-01-1 | No raw chunk logging in prod | lint + rg | `npm run lint` + rg builder export | ⬜ pending |
| 07-01-02 | 01 | 1 | AI-03 | T-07-01-1 | Distinct single-chunk prompt | lint + rg | `npm run lint` + rg `mcqSingleChunk` | ⬜ pending |
| 07-01-03 | 01 | 1 | AI-04, D-27 | T-07-01-1 | No `performance.now` inside `parseChunkSingleMcqOnce` | lint + rg | `npm run lint` + rg acceptance from plan | ⬜ pending |
| 07-02-01 | 02 | 2 | D-27, D-29 | T-07-02-* | Timings gated verbose log | lint + rg | `npm run lint` + rg `chunkAiWallMs` | ⬜ pending |
| 07-02-02 | 02 | 2 | D-28, AI-05, D-16 | — | Run timer + progress retained | lint + rg + manual | `npm run lint` + plan rg set | ⬜ pending |
| 07-02-03 | 02 | 2 | D-26, UI-SPEC | — | Debug collapsed default | lint + rg | `npm run lint` + rg `Chunk parse debug` | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Optional: add Vitest + `npm run test` for `buildLayoutChunksFromRun` pure helpers (deferred — not blocking v1 execute if lint/build pass).

*Existing infrastructure:* `npm run lint` and `npm run build` cover type-safety for touched files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Steps |
|----------|-------------|------------|-------|
| Fast path parse completes | AI-05, D-16 | Needs API key + PDF | Open source page → Fast → Parse; confirm OCR runs if missing, chunks progress, questions appear |
| Accurate vision-only | D-17 | Multimodal cost | Accurate mode → confirm no chunk debug rows; run total may still show |
| Vision fallback footnote | D-28 + UI-SPEC | Rare branch | Force chunk failure threshold → confirm summary footnote when fallback ran |

---

## Validation Sign-Off

- [ ] All plan tasks have automated lint (and build at wave end)
- [ ] Manual table smoke completed once before phase close
- [ ] `nyquist_compliant: true` set after evidence

**Approval:** pending
