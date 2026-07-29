---
phase: 06
slug: bilingual-en-vi-language-selector-and-reusable-contextual-sl
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-26
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for bilingual catalogs, persistent locale state, contextual slang rotation, hydration safety, representative UI integration, and route/layout verification.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 plus TypeScript typecheck and Next.js production build |
| **Config file** | `vitest.config.ts` |
| **Environment** | Node; provider/component behavior uses server rendering or dependency-injected browser boundaries without adding packages |
| **Quick run command** | `npm test -- src/lib/locale src/components/locale --run` |
| **Full suite command** | `npm run lint && npm run typecheck && npm test -- --run && npm run build` |
| **Estimated runtime** | Quick locale suite under 60 seconds; full gate runtime measured during execution |

---

## Sampling Rate

- **After every task:** Run focused test file(s) named by task plus `npm run typecheck`.
- **After every plan wave:** Run `npm test -- src/lib/locale src/components/locale --run`; after integration waves also run `npm test -- --run`.
- **Before `/gsd-verify-work`:** `npm run lint && npm run typecheck && npm test -- --run && npm run build` must be green.
- **Max feedback latency:** 60 seconds for focused task verification; full build remains phase gate.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | LOCALE-01, SLANG-01, SLANG-03, SLANG-04 | T-06-02, T-06-03, T-06-04 | EN/VI parity; every context populated; unsafe content excluded | unit/type | `npm test -- src/lib/locale/messages.test.ts src/lib/locale/slang.test.ts --run && npm run typecheck` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | LOCALE-02, SLANG-02 | T-06-01 | Invalid storage falls back to EN; selection is deterministic and no-repeat | unit | `npm test -- src/lib/locale/selectSlang.test.ts src/lib/locale/localeStorage.test.ts --run` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | LOCALE-03, LOCALE-04, LOCALE-05 | T-06-05, T-06-06 | English first render; validated post-mount locale; no render-time randomness | component | `npm test -- src/components/locale/LocaleProvider.test.tsx --run && npm run typecheck` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | LOCALE-02, LOCALE-05 | T-06-07, T-06-08 | Selector updates literal account/settings/shell copy without changing auth or routes | integration/type | `npm run typecheck && npm test -- src/components/locale --run` | ❌ W0 provider coverage | ⬜ pending |
| 06-03-01 | 03 | 3 | LOCALE-04, SLANG-02, SLANG-03, SLANG-04 | T-06-09, T-06-10 | Supporting slang starts post-hydration, remains stable on rerender, and stays out of errors/ARIA | component | `npm test -- src/components/locale/LocalizedCopy.test.tsx --run && npm run typecheck` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | LOCALE-01, SLANG-01, SLANG-03, SLANG-04 | T-06-09, T-06-11 | Pipeline progress keeps literal status primary and error detail unchanged | integration/type | `npm run typecheck && npm test -- src/components/locale src/lib/locale --run` | ❌ W0 shared coverage | ⬜ pending |
| 06-04-01 | 04 | 4 | LOCALE-01, LOCALE-04, SLANG-01, SLANG-03, SLANG-04 | T-06-12, T-06-13 | Import/generation chrome localizes; source content and precise errors remain unchanged | integration | `npm run typecheck && npm test -- src/lib/locale src/components/locale --run` | ❌ W0 shared coverage | ⬜ pending |
| 06-04-02 | 04 | 4 | LOCALE-01, SLANG-03, SLANG-04 | T-06-14, T-06-15 | Review chrome localizes; generated content and destructive/error copy stay literal | regression | `npm run typecheck && npm test -- --run` | Existing full suite | ⬜ pending |
| 06-05-01 | 05 | 4 | LOCALE-01, LOCALE-04, SLANG-01–04 | T-06-16–19 | Quiz explanation precedes gentle event-stable reaction; score and mistakes behavior unchanged | integration/regression | `npm run typecheck && npm test -- src/lib/locale src/components/locale --run` | ❌ W0 shared coverage | ⬜ pending |
| 06-05-02 | 05 | 4 | LOCALE-01, LOCALE-04, SLANG-01, SLANG-03, SLANG-04 | T-06-16, T-06-19 | Flashcard content and literal announcements remain unchanged while chrome localizes | regression | `npm run typecheck && npm test -- --run` | Existing full suite | ⬜ pending |
| 06-06-01 | 06 | 4 | LOCALE-01, LOCALE-04, SLANG-01, SLANG-03, SLANG-04 | T-06-20, T-06-21, T-06-23 | Dashboard metadata remains data; delete/errors/ARIA contain no slang | integration/type | `npm run typecheck && npm test -- src/lib/locale src/components/locale --run` | ❌ W0 shared coverage | ⬜ pending |
| 06-06-02 | 06 | 4 | LOCALE-01, SLANG-01, SLANG-03 | T-06-22 | Number formatting changes display only; raw values and geometry remain unchanged | regression | `npm run typecheck && npm test -- --run` | Existing full suite | ⬜ pending |
| 06-07-01 | 07 | 5 | LOCALE-01–05, SLANG-01–04 | T-06-24, T-06-27 | Coverage gate detects catalog drift, unsafe placement, hard-coded listed-context copy, and render randomness | audit/full | `node scripts/verify-locale-coverage.mjs && npm run lint && npm run typecheck && npm test -- --run && npm run build` | ❌ created by 06-07 | ⬜ pending |
| 06-07-02 | 07 | 5 | LOCALE-01–05, SLANG-01–04 | T-06-25, T-06-27 | Browser confirms persistence, hydration, safety, accessibility, layout, and workflow preservation | manual checkpoint after automated gate | `node scripts/verify-locale-coverage.mjs && npm run lint && npm run typecheck && npm test -- --run && npm run build` | Manual matrix below | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/locale/selectSlang.test.ts` — deterministic RNG boundaries, immediate no-repeat, empty/one-entry safety, locale/context history isolation.
- [ ] `src/lib/locale/messages.test.ts` — EN/VI literal catalog parity and required domain/key completeness.
- [ ] `src/lib/locale/slang.test.ts` — all required contexts in both locales, nonempty/duplicate checks, forbidden tone/content/context policy.
- [ ] `src/lib/locale/localeStorage.test.ts` — valid EN/VI persistence, missing/invalid/cleared fallback, SSR/no-window safety.
- [ ] `src/components/locale/LocaleProvider.test.tsx` — English first render, post-mount validated preference, document language, cross-tab sync, no render-time random selection.
- [ ] `src/components/locale/LocalizedCopy.test.tsx` — post-hydration slang, stable unrelated rerenders, semantic-transition rotation, locale/context matching, error/disabled suppression.
- [ ] Manual route/layout matrix — account and Settings selectors, shell/command palette, dashboard, import/conversion, both generators, quiz feedback/done, flashcard session/done, review/toasts, mobile navigation, errors/destructive/accessibility bans.

No new test framework or package installation required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Initial hydration and persisted locale | LOCALE-03, LOCALE-04 | Browser hydration console and real localStorage lifecycle | Clear `doc2quiz.locale`, load app, confirm English and no hydration warning; select VI, reload, verify VI and `<html lang="vi">`; set invalid value and verify EN fallback. |
| Selector placement and keyboard use | LOCALE-02, LOCALE-05 | Base UI focus/keyboard and visual selected state | Use account-menu compact selector and Settings full selector by keyboard; verify both update same provider without reload and controls retain ≥44px targets. |
| Cross-tab synchronization | LOCALE-03 | Requires two browser tabs and native storage event | Open two tabs, change locale in one, confirm other updates without route or auth change. |
| App-shell and listed-context coverage | LOCALE-01, LOCALE-05 | Broad route-level mixed-language detection | Check top bar, command palette, Settings, dashboard, import/conversion, canonical/generation, quiz/flashcard review, practice, results, badges, toasts, progress, and mobile navigation in EN and VI. |
| Slang semantic rotation and safety | SLANG-01–04 | Natural state transitions and editorial appropriateness need human judgment | Trigger consecutive loading steps, correct/wrong answers, retries, successes, empty states, streak/score/results; confirm no immediate repeat, no timer-driven changes, literal copy first, gentle wrong feedback, and zero slang in serious errors/destructive/auth/privacy/accessibility copy. |
| Study-content preservation | LOCALE-05 | Requires real user/source/generated data across routes | Switch locale while viewing titles, filenames, canonical Markdown, MCQs/options/explanations, and flashcard front/back; confirm content remains byte-for-byte conceptually unchanged. |
| Responsive layout preservation | LOCALE-05 | Vietnamese length, wrapping, touch targets, and geometry require visual inspection | At 375px and desktop widths inspect selectors, top bar, dashboard cards/badges, progress cards, quiz/flashcard controls, review workspaces, and done pages; confirm no clipping, overflow, hidden controls, reordered content, or card/grid geometry regression. |
| Keyboard/accessibility preservation | LOCALE-05, SLANG-04 | Focus, announcements, and assistive semantics require interactive verification | Verify quiz 1–4/Enter/Space/ArrowRight, flashcard Space/arrows/focus, command palette shortcut, literal ARIA announcements, reduced motion, and no slang in accessibility instructions. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or explicit Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 maps every missing test from research plus provider/localized-copy component coverage.
- [x] No watch-mode flags in validation commands.
- [x] Focused feedback target is under 60 seconds; full suite/build reserved for phase gate.
- [x] `nyquist_compliant: true` set in frontmatter.
- [ ] Wave 0 test files created and green.
- [ ] Full phase gate green.
- [ ] Manual route/layout matrix approved.

**Approval:** pending
