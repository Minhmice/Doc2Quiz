---
phase: 3
slug: canonical-knowledge
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-25
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm test -- --run && npm run build` |

## Per-Task Verification Map

| Area | Requirement | Command | Status |
|------|-------------|---------|--------|
| Prompt loader + Zod | CANON-08 | `npm test -- --run canonicalSchemas` | ⬜ |
| Canonicalize service | CANON-01–07 | `npm test -- --run canonicalize` | ⬜ |
| API routes | CANON-* | `npm test -- --run canonicalize/route` | ⬜ |
| Preview UI | ROADMAP #4 | manual smoke | ⬜ |

## Manual-Only

- End-to-end: ingest → auto-canonicalize → preview page shows canonical markdown
- Verify `prompt/canonical_builder_v1.json` version logged in metadata

**Approval:** pending
