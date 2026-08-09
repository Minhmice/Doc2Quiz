---
phase: 16-ide-themes
verified: 2026-08-08T12:41:11Z
status: gaps_found
score: 3/6 must-haves verified
requirements_score: 2/5 plan-declared requirements satisfied
re_verification: false
human_verification:
  status: approved_with_static_overrides
  approved_on: 2026-08-08
  overridden_claims:
    - keyboard selector traversal
    - High Contrast flashcard readability
requirements:
  satisfied: [THEME-01, THEME-02]
  gaps: [THEME-03, THEME-04, THEME-05]
traceability_defect: null
---

# Phase 16: IDE Themes Verification Report

**Phase Goal:** Signed-in users select and persist an IDE-inspired visual theme from Settings. Selection syncs across devices and avoids a wrong-theme flash on first paint.

**Verification target:** `.planning/phases/16-ide-themes` only. Phase 12 Study Together remains unrelated and excluded.

**Verdict:** GAPS FOUND. Persistence contract and server pre-paint application exist, but reproducible keyboard, mutation-ordering, account-boundary, and High Contrast defects prevent full goal achievement.

## Goal-Backward Must-Haves

| # | Plan truth | Status | Evidence |
|---|---|---|---|
| 1 | Signed-in user preference survives device/browser changes. | PARTIAL / GAP | Database persistence exists through validated `PATCH /api/profile` (`src/app/api/profile/route.ts:141-161,193-228`) and constrained profile storage (`supabase/migrations/20260731210000_profile_theme_preference.sql:3-20`). However, a provider preserved across client-side sign-in never adopts a later authenticated server preference: state initializes once at `src/components/providers/ThemePreferenceProvider.tsx:35-38`, while the prop-change effect at lines 40-46 only reads storage when the prop is `undefined`. Concurrent saves can also leave database and UI on different values because each request independently persists and rolls back (`ThemePreferenceProvider.tsx:63-82`). |
| 2 | First paint uses known server theme value without hydration mismatch. | VERIFIED | Root layout authenticates and reads the allowlisted account value server-side (`src/app/layout.tsx:37-48`), emits a head script that resolves and applies the palette before body paint (`src/app/layout.tsx:55-65`), supplies compatible initial next-themes state (`src/app/layout.tsx:79-88`), and suppresses the intentional root attribute reconciliation warning (`src/app/layout.tsx:59-63`). Human checkpoint approved no wrong-theme flash/hydration warning. |
| 3 | Invalid API/database theme values safely fall back to system. | VERIFIED | Shared allowlist/default logic is in `src/lib/profile/themePreference.ts:1-18`; GET normalizes malformed stored values at `src/app/api/profile/route.ts:66-74`; PATCH rejects unsupported values at `src/app/api/profile/route.ts:193-220`; migration repairs invalid/null rows and enforces default, NOT NULL, and check constraint at `supabase/migrations/20260731210000_profile_theme_preference.sql:6-20`. Unit fallback checks pass (`src/lib/profile/themePreference.test.ts:9-22`). |
| 4 | Four named IDE-inspired palettes visibly change core application surfaces. | PARTIAL / GAP | Four substantive document and nested study-surface token sets exist (`src/app/globals.css:110-152`) and cover shadcn, sidebar/chart, d2q, and qp tokens. High Contrast violates core flashcard readability: it sets `--qp-secondary: #ffff00` and `--qp-on-primary-container: #ffffff` (`globals.css:143-151`), while action labels force white over those backgrounds (`src/components/flashcards/FlashcardActions.tsx:43-60`). Independent contrast probe measured 1.07:1 white/yellow and 1.00:1 white/white. |
| 5 | Settings selector is keyboard usable and persists selected value. | GAP | Appearance precedes Language (`src/app/(app)/settings/SettingsPageClient.tsx:26-37`), exposes five named radio cards, swatches, selected state, roving tabindex, and live feedback (`src/components/settings/AppearanceSettings.tsx:35-83`), and calls shared persistence (`AppearanceSettings.tsx:24-32`). Keyboard traversal is broken: localized options are cloned at line 22, then `OPTIONS.indexOf(option)` at line 58 always returns `-1`; Right/Down always select `system`, Left/Up always select `monokai`. Existing test only searches source strings and dispatches no keys (`src/components/settings/AppearanceSettings.test.tsx:17-43`). Persistence also lacks overlapping-request reconciliation (`ThemePreferenceProvider.tsx:63-82`). |
| 6 | System option chooses VS Code Dark/Light based on OS. | VERIFIED | Pre-paint script maps `system` through `matchMedia` (`src/app/layout.tsx:56`); client mapping uses resolved theme and reruns when it changes (`src/components/providers/ThemePreferenceProvider.tsx:20-27,48-53`). Dark compatibility includes VS Code Dark, Monokai, and High Contrast; VS Code Light removes `dark` (`ThemePreferenceProvider.tsx:20-27`). Human checkpoint approved both OS schemes. |

**Score:** 3/6 must-haves fully verified.

## Requirement Accounting

Requirement meanings below match central Phase 16 traceability.

| Requirement | Declared by | Claim evaluated | Status | Evidence |
|---|---|---|---|---|
| THEME-01 | `16-01-PLAN.md` | Validated account theme preference contract | SATISFIED | Shared allowlist, migration constraint, authenticated GET/PATCH contract: `themePreference.ts:1-18`, migration lines 3-20, `route.ts:29-39,66-74,141-228`. |
| THEME-02 | `16-01-PLAN.md` | Authenticated server preference seeds first paint; System resolves to VS Code light/dark | SATISFIED | `src/app/layout.tsx:37-65,79-88`; approved browser checkpoint. |
| THEME-03 | `16-01-PLAN.md` | Immediate selection, durable persistence, synchronization, safe rollback | GAP | Basic path exists at `ThemePreferenceProvider.tsx:48-82`, but account-boundary adoption and overlapping mutations are unsafe; unguarded local storage can stop authenticated PATCH before it starts (`ThemePreferenceProvider.tsx:42,52,67-68`). |
| THEME-04 | `16-02-PLAN.md` | Four coherent, contrast-safe core palettes | GAP | Palette declarations exist at `globals.css:110-152`, but High Contrast core flashcard actions are unreadable at `FlashcardActions.tsx:49,60`. |
| THEME-05 | `16-02-PLAN.md` | Accessible account-backed Settings selector | GAP | Structure and localization exist at `AppearanceSettings.tsx:35-83` and `src/lib/locale/messages.ts:74-80,380-386`; arrow navigation fails at `AppearanceSettings.tsx:22,44,58-60`, and persistence concurrency remains unresolved. |

**Requirement score:** 2/5 satisfied, 3/5 gaps.

### Traceability

`THEME-01` through `THEME-05` are centrally defined and mapped to Phase 16. SOCIAL requirements remain mapped to Phase 12 Study Together.

## Key Wiring and Data Flow

| From | To | Via | Status |
|---|---|---|---|
| Root server layout | Current account profile | Authenticated Supabase `profiles.theme_preference` read (`src/app/layout.tsx:37-48`) | WIRED |
| Root server layout | First document paint | Inline allowlisted theme resolver in `<head>` (`src/app/layout.tsx:55-65`) | WIRED |
| Settings selector | Shared controller | `useThemePreference` and `setThemePreference` (`src/components/settings/AppearanceSettings.tsx:18-32`) | WIRED, behavior gaps |
| Shared controller | Profile persistence | Authenticated `PATCH /api/profile` (`src/components/providers/ThemePreferenceProvider.tsx:63-82`) | WIRED, concurrency/account-boundary gaps |
| Profile API | Supabase account row | Own authenticated profile upsert (`src/app/api/profile/route.ts:141-143,210-228`) | WIRED |
| Document `data-theme` | Shell/study palettes | Root and nested Stitch selectors (`src/app/globals.css:110-152`) | WIRED, High Contrast foreground gap |
| Quick theme control | Appearance Settings | Settings navigation (`src/components/layout/ThemeToggle.tsx:7-20`) | WIRED |

## Automated and Targeted Checks

| Check | Result |
|---|---|
| `npm run test -- src/lib/profile/themePreference.test.ts src/components/settings/AppearanceSettings.test.tsx src/app/api/profile/route.test.ts --run` | PASS — 3 files, 12 tests |
| `npm run typecheck` | PASS |
| Focused ESLint across phase implementation/test files and flashcard consumer | PASS — 0 errors; one existing `@next/next/no-img-element` warning at `src/components/layout/AccountMenu.tsx:61` |
| Targeted navigation probe reproducing cloned-option `indexOf` logic | FAIL AS EXPECTED — index `-1`; Right resolves `system`, Left resolves `monokai` |
| Targeted WCAG luminance probe | FAIL — white/yellow 1.07:1; white/white 1.00:1 |
| Production build | Previously PASS at unchanged implementation state per `16-02-SUMMARY.md:114-124`; not rerun to avoid modifying preserved `next-env.d.ts` |

Test limitations: `AppearanceSettings.test.tsx:26-42` verifies source text rather than interactions. Current `src/app/api/profile/route.test.ts:24-189` contains avatar tests only and does not exercise theme GET/PATCH behavior despite summary attribution.

## Human Verification Status

Plan 16-02 checkpoint was approved on 2026-08-08 for desktop/mobile palettes, System under light/dark OS, reload, second tab, another browser/device, first paint, keyboard focus, contrast, and non-color-only meaning (`16-02-SUMMARY.md:126-128`). Approval remains useful evidence for runtime first paint and normal persistence paths, but cannot override deterministic contradictions:

- Keyboard traversal claim is disproved by referentially impossible `OPTIONS.indexOf(option)` and reproduced probe.
- High Contrast readability claim is disproved by exact CSS foreground/background pairs and measured ratios.
- Approval does not cover account state changing from signed-out to signed-in without remount or adversarial overlapping PATCH completion order.

## Review-Finding Disposition

| Finding | Disposition | Verification evidence |
|---|---|---|
| WR-01 arrow navigation starts from `-1` | CONFIRMED; goal-blocking | `AppearanceSettings.tsx:22,44,58-60`; targeted probe reproduced fixed wrong destinations. |
| WR-02 account preference not adopted after client-side sign-in | CONFIRMED; goal-blocking | `ThemePreferenceProvider.tsx:35-46` never copies a newly defined `initialPreference` into preserved state; root only passes preference after authenticated server render at `layout.tsx:88`. |
| WR-03 overlapping saves can diverge UI/storage/database | CONFIRMED; goal-blocking | Independent captured `previous` values and unsynchronized PATCH/rollback at `ThemePreferenceProvider.tsx:63-82`; no mutation ID, queue, abort, or server reconciliation. |
| WR-04 High Contrast flashcard labels unreadable | CONFIRMED; goal-blocking | `globals.css:151` paired with `FlashcardActions.tsx:49,60`; 1.07:1 and 1.00:1 probes. |
| IN-01 unavailable local storage breaks initialization/saving | CONFIRMED; resilience defect | Pre-paint access is guarded (`layout.tsx:56`), but provider accesses at `ThemePreferenceProvider.tsx:42,52,67,78` are unguarded; line 67 can throw before PATCH. |

No review finding was disproved.

## Exact Gap Closure Needed

1. **Fix radio traversal.** Calculate from `options.map((option, index) => ...)` index or value lookup. Add real interaction tests dispatching all four arrow keys and asserting focus, `aria-checked`, and wraparound.
2. **Adopt account preference at auth boundaries.** Pass stable account identity and key/reset provider on identity change, or explicitly reconcile state when account identity and server preference change. Test `initialPreference` transition from `undefined` to a named account theme.
3. **Make persistence latest-selection-safe.** Serialize mutations or use monotonic mutation IDs plus explicit latest-value server reconciliation. Add deferred-response tests for older-success/newer-success and older-failure/newer-success orderings; final DOM, storage, provider state, and database must match latest selection.
4. **Fix High Contrast action foregrounds.** Add semantic action-foreground tokens and remove hardcoded `text-white` where backgrounds vary. High Contrast needs black on yellow and a contrasting Next foreground/background pair. Add automated WCAG contrast checks for action token pairs.
5. **Make local storage optional.** Wrap reads/writes so storage denial or quota errors do not block DOM application or authenticated API persistence.
6. **Repair automated coverage.** Replace source-string selector assertions with interaction tests; add profile route tests for all valid values, malformed PATCH rejection, GET fallback, auth boundary, and persisted field mapping.
7. **Preserve central traceability.** Keep THEME-01 through THEME-05 mapped to Phase 16 without assigning SOCIAL requirements or changing Study Together metadata.

## Next Action

Create gap-closure plan for THEME-03, THEME-04, and THEME-05, implement fixes above, rerun focused tests/typecheck/build, then re-verify this phase. Keep `.planning/phases/12-study-together` untouched.

---

_Verified: 2026-08-08T12:41:11Z_  
_Verifier: gsd-verifier_
