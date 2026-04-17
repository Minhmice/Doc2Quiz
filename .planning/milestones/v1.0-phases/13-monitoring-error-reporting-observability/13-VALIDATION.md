---
phase: 13
slug: monitoring-error-reporting-observability
status: draft
nyquist_compliant: true
wave_0_complete: true
created: "2026-04-11"
---

# Phase 13 — Validation strategy

Phase 13 adds **optional Sentry** and **pipeline-tagged** error capture. Research was skipped (`workflow.research: false`); validation is **command-based** (no new test framework in this phase).

## Test infrastructure

| Property | Value |
|----------|-------|
| Lint | `npm run lint` |
| Build / types | `npm run build` |

## Sampling

- After **13-01** merge: `npm run lint` and `npm run build`.
- After **13-02** merge: same; confirm no `console`/lint regressions in touched files.

## Per-plan checks

| Plan | Automated | Manual (optional) |
|------|-------------|-------------------|
| 13-01 | `npm run lint`, `npm run build` | With DSN set in preview: confirm SDK loads (no client crash). |
| 13-02 | `npm run lint`, `npm run build` | Trigger a wired failure path; confirm Sentry event carries tags `d2q_pipeline_domain` / `d2q_pipeline_stage` and **no** raw PDF / API key in payload. |

## Sign-off

- [x] Validation doc present for Nyquist dimension 8e when plans exist without RESEARCH.md.
- [ ] Executor sets `nyquist_compliant: true` in frontmatter after wave verification (or leaves draft until execute).
