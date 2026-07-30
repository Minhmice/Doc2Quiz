---
phase: 07-normalize-app-information-architecture-around-setid-based-qu
status: human-verify-pending
nyquist: enabled
last_gate_run: 2026-07-30
---
# Phase 7 Validation

## Mandatory Preservation Gate
Plan 01 creates `07-DIRTY-PREFLIGHT.txt` from scoped status/diffs and obtains explicit no-commit authorization. Every plan captures pre-task scoped diffs, compares to that baseline, prohibits reset/checkout/clean/blanket replacement/staging/commits on overlaps, and performs post-task scoped-diff plus `git diff --check`. Phase 6 06-06 dashboard/locale hunks are named preservation fixtures.

## Automated Gates
| Requirement | Evidence | Exact command |
|---|---|---|
| IA-01 | Canonical helper contract | `npm test -- src/lib/routes/studySetPaths.test.ts src/lib/dashboard/studySetDashboardLinks.test.ts --run` |
| IA-01 | Pre-deletion zero forbidden live callers/config/helpers/tests/imports/redirects/middleware/loaders, excluding only the four enumerated legacy route roots | `npm run verify:phase7-callers` |
| IA-01 | Post-deletion full references plus filesystem route inventory/product `[id]` segments, with no legacy-root exclusion | `npm run verify:phase7-references` |
| IA-01, IA-05, IA-06 | Canonical build inventory plus authenticated production HTTP; old paths exact 404/no Location | `npm run verify:phase7-routes` |
| IA-02 | Shared pipeline clients | `npm test -- src/lib/client/quizGenerateStudySet.test.ts src/lib/client/flashcardGenerateStudySet.test.ts --run` |
| IA-03 | Card D-09–D-13 statuses/actions/previews/privacy | `npm test -- src/components/dashboard/DashboardStudySetCard.test.tsx --run` |
| IA-04, IA-08, IA-09 | URL, smart resume, durable mistake ordering/destinations | `npm test -- src/hooks/useDashboardHome.test.ts src/lib/client/activityTracking.test.ts --run` |
| IA-10 | EN/VI parity and slang safety | `npm test -- src/lib/locale --run` |
| IA-01–10 | Final integrity, strictly after deletion/full audit | `npm run verify:phase7-callers && npm run verify:phase7-references && npm run verify:phase7-routes && npm run typecheck && npm run lint && npm test -- --run && npm run build` |

## Plan 07-09 Gate Run (2026-07-30)

| Command | Result | Evidence |
|---------|--------|----------|
| `npm run verify:phase7-callers` | PASS | `0 forbidden caller references` |
| `npm run verify:phase7-references` | PASS | `0 forbidden route references` |
| `npm run verify:phase7-routes` | PASS | `Phase 7 route smoke passed: manifest inventory, fail-closed negatives, canonical authenticated routes, and exact legacy 404s.` |
| `npm run typecheck` | PASS | Clean after local layout/quota typing workaround (uncommitted) |
| `npm run lint` | FAIL | 4 errors in unrelated dirty files (workspace reader hooks, `workspaceSummary.ts` prefer-const) |
| `npm test -- --run` | FAIL | 17 failures in phase 9 legacy-bridge API route tests |
| `npm run build` | PASS | Included in `verify:phase7-routes` |

**Human matrix:** Pending — follow Manual Route and Layout Matrix below at 1440px/375px EN/VI. Resume signal: `approved` or list failing cells.

## Deterministic Route Smoke Contract
`scripts/verify-phase7-route-smoke.mjs` must parse `.next/server/app-paths-manifest.json`, assert all D-02 route keys and absence of legacy keys, create random temporary Supabase Auth/user-owned set fixtures through runtime credentials, obtain real Supabase auth cookies, spawn production server on port 4317 without any smoke-auth environment switch, fetch with `redirect: manual`, and always terminate the server and delete fixtures/user in nested `finally` blocks. It reuses the exact existing boundary `src/proxy.ts` → `src/lib/supabase/middlewareClient.ts` → `src/lib/supabase/auth-guard.ts`; those three files require no modification.

Fail-closed negatives assert that `D2Q_ROUTE_SMOKE_AUTH=1` without a header does not authenticate, a random `x-d2q-route-smoke-secret` without the flag does not authenticate, both together do not authenticate because no backdoor exists, normal production startup has no smoke path, and no `D2Q_ROUTE_SMOKE_SECRET` value/default is committed. There is no conditional skip.

Canonical fixture routes return 200 and no 3xx. `/dashboard` normalization is asserted explicitly. Representative old paths `/edit/new`, `/edit/new/quiz`, `/edit/quiz/{id}`, `/sets/{id}/source`, `/flashcards/{id}`, `/quiz/{id}/done`, `/quiz/{id}?review=mistakes` return exactly 404, have no `Location`, and are never 3xx.

## Resume and Mistake Test Matrix
- Session: currentItemId displayed semantics; nextItemId after committed action; answer/known restoration; save after semantic actions plus pagehide/visibility flush; exact reload/browser-close restore; final action persisted before completion; owner/set/mode/practice validation; missing/reordered/new item reconciliation; revision/updated_at stale-write rejection; completed exclusion.
- Mistakes: owner/set/item/mode unique upsert; increment/repeat; resolution; unresolved-only; cross-mode isolation; total count desc then lastPracticedAt desc; empty; canonical drill destinations for both modes.

## Dashboard Card D-09–D-13 Matrix
Assert type overview click, D-10 metadata, all D-11 status CTAs, all D-12 secondary actions, max-three previews, flagged/unreviewed priority, fallback first-three, quiz answer/choice/correct-answer absence, flashcard-back absence, total count, and canonical View all in Review.

## Manual Route and Layout Matrix
At 1440px and 375px, EN/VI, light/dark where relevant: dashboard URL preservation and mistake ordering; cards/overviews; both Source→Convert→Generate→Review wizards; separate review/edit; keyboard play/drill with all persistent navigation hidden and Exit; exact reload/browser-close/multiple-session resume; results shell/actions; desktop sidebar collapse; mobile top-level bottom nav versus nested contextual bar with no hamburger; Help/settings; 44px targets, focus/ARIA, contrast/reduced motion/no overflow; unchanged IDs and user/generated content; unchanged unrelated dirty/Phase 6 hunks.

## Source Coverage Audit
- GOAL covered Plans 01–09.
- REQ IA-01–10 appears in plan frontmatter and gates.
- RESEARCH excluded by `--skip-research`; none created.
- CONTEXT: D-01–D-05 Plans 01/08/09; D-06 Plans 01/06/07/09; D-07 Plan 03; D-08 Plans 03/06/07; D-09–D-13 Plan 04/06/07; D-14–D-17 Plan 04; D-18–D-23 Plan 05; D-24–D-26 Plans 02/04/06/07; D-27 Plan 05. Deferred ideas absent.
