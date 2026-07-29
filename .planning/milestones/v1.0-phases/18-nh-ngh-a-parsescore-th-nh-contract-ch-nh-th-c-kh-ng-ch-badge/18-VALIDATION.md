---
phase: 18
slug: nh-ngh-a-parsescore-th-nh-contract-ch-nh-th-c-kh-ng-ch-badge
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 18 — Validation Strategy

> Validation for **parseScore contract** (types + doc + pure derivation). No new test framework; reuse project ESLint and Next production build.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | ESLint (flat) + Next.js 15 typecheck via `next build` |
| **Config file** | `eslint.config.mjs`, `tsconfig.json` |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~30–90s (build) |

## Sampling Rate

- After every task: `npm run lint`
- After wave 2 final task: `npm run lint && npm run build`
- Before `/gsd-verify-work`: lint + build green on branch

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-T1 | 01 | 1 | Phase 18 goal (doc) | T-18-01-01..03 | Doc/types non-authoritative for billing | lint | `npm run lint` | ✅ | ⬜ pending |
| 18-01-T2 | 01 | 1 | Phase 18 goal (types) | T-18-01-01..03 | No new network/secret surfaces | lint | `npm run lint` | ✅ | ⬜ pending |
| 18-02-T1 | 02 | 2 | Derivation purity | T-18-02-01..03 | Pure functions, no fetch/storage | lint | `npm run lint` | ✅ | ⬜ pending |
| 18-02-T2 | 02 | 2 | Badge compatibility | T-18-02-03 | Tier logic unchanged | lint + build | `npm run lint && npm run build` | ✅ | ⬜ pending |

## Wave 0 Requirements

- **None** — existing `npm run lint` / `npm run build` cover TypeScript and ESLint; no new test stubs required for this documentation-first + pure-module phase.

## Manual-Only Verifications

| Behavior | Why manual | Test instructions |
|----------|------------|-------------------|
| Review badge visual parity | UI | After 18-02, open Review with known draft questions; confirm mapping badges match pre-phase behavior for same fixtures. |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (see PLAN.md) or Wave 0 waived above
- [x] No three consecutive tasks without automated verify
- [x] Wave 0 N/A — documented
- [x] Feedback via lint/build only (no watch mode)
- [x] `nyquist_compliant: true` in frontmatter

**Approval:** approved 2026-04-11 (orchestrator — Nyquist gate satisfied for plan-check)
