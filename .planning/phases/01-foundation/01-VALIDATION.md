---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in plan 01-03 if missing) |
| **Config file** | vitest.config.ts (created in plan 01-03 if missing) |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run lint && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CANON-09 | T-01-01 | N/A (schema files only) | manual | `ls supabase/migrations/*.sql` count = 1 | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CANON-09 | T-01-01 | RLS policies on all tables | manual | SQL review | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CANON-09 | — | N/A | build | `npm run typecheck && npm run build` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 2 | CORE-AUTH-01 | T-01-02 | Session refresh via proxy | build | `npm run typecheck` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 2 | CORE-AUTH-01 | T-01-02 | Real Supabase clients | build | `npm run build` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 2 | INPUT-VAL-01 | — | N/A | unit (RED) | `npm test -- --run validation.test.ts` expect fail | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | INPUT-VAL-01 | — | N/A | unit | `npm test -- --run validation.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 3 | CORE-AUTH-01 | T-01-03 | API routes require auth | build | `npm run typecheck` | ✅ | ⬜ pending |
| 01-04-02 | 04 | 3 | CANON-09 | — | CRUD + 501 stubs | build | `npm run build` | ✅ | ⬜ pending |
| 01-05-01 | 05 | 3 | CANON-09 | — | studySetDb queries | build | `npm run typecheck` | ✅ | ⬜ pending |
| 01-05-02 | 05 | 3 | CORE-AUTH-01/02 | T-01-04 | Logout clears session | manual | Auth smoke checklist | ❌ W0 | ⬜ pending |
| 01-05-03 | 05 | 3 | CORE-AUTH-01 | — | requireUser redirect | manual | Visit /dashboard unauthenticated | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/pipeline/validation.test.ts` — covers INPUT-VAL-01 exports (plan 01-03)
- [ ] Vitest + `npm test` script if missing (plan 01-03)
- [ ] Manual auth smoke checklist documented in plan 01-05 checkpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login persists across navigation | CORE-AUTH-01 | Requires Supabase `.env.local` | Sign in → navigate dashboard → refresh → still authenticated |
| Logout clears session | CORE-AUTH-02 | Cookie/session state | Click Log out → visit /dashboard → redirected to /login |
| Schema applies locally | CANON-09 | D-02 no remote push | Optional: `supabase db reset` when user configures project |
| Protected route redirect | CORE-AUTH-01 | Browser redirect | Visit `/dashboard` logged out → `/login?next=...` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
