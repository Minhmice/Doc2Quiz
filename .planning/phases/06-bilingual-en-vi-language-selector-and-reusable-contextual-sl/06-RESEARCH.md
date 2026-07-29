# Phase 6: Bilingual EN/VI Language Selector and Reusable Contextual Slang - Research

**Researched:** 2026-07-26
**Domain:** Client-side localization, contextual microcopy, deterministic copy rotation
**Confidence:** HIGH

## Summary

Phase 6 should add a small, project-owned localization layer rather than introduce a general i18n package. Doc2Quiz currently renders hard-coded English throughout client and server components, has no locale abstraction, and already uses a provider-plus-storage pattern for user preferences. [VERIFIED: codebase — `src/components/profile/DisplayNameProvider.tsx`, `src/components/layout/AppProviders.tsx`] Scope requires only two fixed locales and canonical project dictionaries, so typed TypeScript catalogs plus a `LocaleProvider` minimize migration risk and preserve layout. [VERIFIED: project docs — `TASTE.md`, `dictionary/Brainrot_Slang.md`, `dictionary/Slang_Dictionary.md`]

Separate literal product copy from optional slang. Every surface must remain understandable without slang; errors, destructive actions, account/privacy/accessibility instructions, and primary actions stay literal. Slang belongs in secondary labels, reactions, loading companions, empty-state captions, and result embellishment at density limits defined in `TASTE.md`. [VERIFIED: project docs — `TASTE.md` lines 173–211, 235–270; `dictionary/Slang_Dictionary.md` lines 147–158]

Locale persistence has an SSR/hydration constraint: root HTML currently renders `lang="en"`, while app preference patterns read `localStorage` only after mount. [VERIFIED: codebase — `src/app/layout.tsx`, `src/components/profile/DisplayNameProvider.tsx`] Planner should choose localStorage as phase persistence, use English as identical server/first-client fallback, update `document.documentElement.lang` after hydration, and avoid rendering locale-dependent random slang during SSR. This prevents hydration mismatch without adding DB/schema work. [ASSUMED]

**Primary recommendation:** Build typed `en`/`vi` product catalogs, typed contextual slang banks, pure selection utilities with injected randomness, and one app-level locale provider; then migrate surfaces in waves from shared shells outward.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Locale state and selector | Browser / Client | Frontend Server (SSR) | User changes preference interactively; server supplies stable fallback markup. [VERIFIED: codebase] |
| Locale persistence | Browser / Client | — | Existing preference precedent uses localStorage and storage events. [VERIFIED: codebase] |
| Product translations | Browser / Client | Frontend Server (SSR) | Shared static TypeScript data serves client components and deterministic server fallback. [ASSUMED] |
| Contextual slang selection | Browser / Client | — | Rotation depends on session history and should not run during SSR. [ASSUMED] |
| Accessibility labels/status | Browser / Client | Frontend Server (SSR) | Visible and assistive copy must change together, while first render remains deterministic. [ASSUMED] |
| Canonical slang governance | Source data / build-time | — | Project dictionaries and taste contract are canonical editorial inputs, not runtime fetches. [VERIFIED: project docs] |

## Standard Stack

### Core

| Library / Facility | Version | Purpose | Why Standard |
|--------------------|---------|---------|--------------|
| React Context + hooks | Existing React 19.2.8 | Locale state, translation access, preference updates | Already used for display name and app-scoped state. [VERIFIED: codebase — `package.json`, `DisplayNameProvider.tsx`] |
| TypeScript `as const` data | Existing TypeScript 6.0.3 | Typed locale keys, contexts, and catalogs | Meets structured-data constraint and catches missing/invalid keys at compile time. [VERIFIED: codebase — `package.json`] |
| Browser `localStorage` + `storage` event | Web platform | Persist locale and sync tabs | Existing project preference pattern already handles both. [VERIFIED: codebase — `DisplayNameProvider.tsx`, `displayNameStorage.ts`] |
| Vitest | Existing 3.2.4 | Pure utility and catalog parity tests | Existing test runner, alias config, and Node environment. [VERIFIED: codebase — `package.json`, `vitest.config.ts`] |

### Supporting

| Facility | Purpose | When to Use |
|----------|---------|-------------|
| `Intl.NumberFormat` | Locale-aware counts, percentages, score labels | User-visible formatted numbers; raw quiz math remains numeric. [ASSUMED] |
| Sonner | Localized toast rendering | Existing success/error toast sites. [VERIFIED: codebase — `src/components/ui/sonner.tsx` and toast imports] |
| Existing Base UI dropdown/select primitives | Accessible selector UI | Account menu or settings selector; preserve current shell geometry. [VERIFIED: codebase — `AppTopBar.tsx`, UI primitives] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Project-owned typed catalogs | Full i18n package | Useful for route locales, ICU messages, and many languages, but unnecessary dependency and migration breadth for two local client-selected locales. [ASSUMED] |
| localStorage | Supabase profile column | Cross-device persistence, but requires schema/API/auth-profile work absent from Phase 6 requirements. [ASSUMED] |
| Post-hydration `document.lang` update | Locale cookie read in root layout | Better SSR locale fidelity, but requires request/cookie mutation design and cache analysis. Could be later enhancement. [ASSUMED] |

**Installation:** No external packages required. [VERIFIED: codebase and phase constraints]

## Package Legitimacy Audit

Not applicable. Phase should install no packages.

## Architecture Patterns

### System Architecture Diagram

```text
App server render
  -> fixed EN fallback catalog
  -> deterministic HTML (`lang="en"`)
  -> client hydration
  -> LocaleProvider reads validated localStorage locale
       -> locale changed? yes -> update provider + localStorage + `<html lang>`
       -> no -> retain EN
  -> components request literal copy by typed key
  -> eligible surfaces request slang by typed context
       -> filter locale/context bank
       -> exclude previous phrase for same context
       -> choose with injected RNG
       -> store last phrase in session memory
  -> render literal primary copy + optional slang support copy
```

### Recommended Project Structure

```text
src/
├── lib/locale/
│   ├── types.ts              # Locale, MessageKey, SlangContext
│   ├── messages.ts           # EN/VI literal product catalogs
│   ├── slang.ts              # EN/VI contextual slang banks
│   ├── selectSlang.ts        # pure no-repeat selector
│   └── localeStorage.ts      # validated localStorage boundary
├── components/locale/
│   ├── LocaleProvider.tsx    # provider, hook, hydration, document.lang
│   └── LanguageSelector.tsx  # EN/VI explicit control
└── lib/locale/*.test.ts      # parity, selection, persistence tests
```

### Pattern 1: Typed Catalog Parity

**What:** Define one canonical key shape and require both locales to satisfy it. Support interpolation with typed functions or explicit parameters rather than ad-hoc string replacement. [ASSUMED]

**When to use:** All literal UI, navigation, progress labels, status text, badges, toast text, ARIA labels, warnings, and result copy.

```typescript
// Project-derived pattern; exact symbols are planner guidance.
export const en = {
  navigation: { settings: "Settings", logout: "Log out" },
  quiz: { score: (correct: number, total: number) => `${correct} / ${total} correct` },
} as const;

export type Messages = typeof en;

export const vi = {
  navigation: { settings: "Cài đặt", logout: "Đăng xuất" },
  quiz: { score: (correct: number, total: number) => `${correct} / ${total} câu đúng` },
} satisfies Messages;
```

### Pattern 2: Context-Keyed Slang Data

**What:** Use a closed `SlangContext` union covering requested surfaces. Keep literal translations and slang banks separate. Each entry may carry appropriateness metadata so unsafe categories cannot leak into warnings/errors. [VERIFIED: project dictionaries define usage labels and density boundaries]

**Required contexts:** `loading`, `upload`, `conversion`, `quizGeneration`, `flashcardGeneration`, `correct`, `wrong`, `retry`, `success`, `empty`, `warning`, `streak`, `score`, `navigation`, `toast`, `progress`, `result`, `badge`, `secondaryLabel`.

```typescript
export type Locale = "en" | "vi";
export type SlangContext =
  | "loading" | "upload" | "conversion"
  | "quizGeneration" | "flashcardGeneration"
  | "correct" | "wrong" | "retry" | "success"
  | "empty" | "warning" | "streak" | "score"
  | "navigation" | "toast" | "progress"
  | "result" | "badge" | "secondaryLabel";

type SlangEntry = Readonly<{
  text: string;
  tone: "praise" | "encourage" | "playful" | "warning" | "easterEgg";
}>;

type SlangCatalog = Readonly<Record<Locale, Readonly<Record<SlangContext, readonly SlangEntry[]>>>>;
```

### Pattern 3: Pure No-Consecutive-Repeat Selection

**What:** Make selection pure at utility level: candidate bank, previous text, and RNG enter; selected text exits. Provider/helper owns per-context previous values. Excluding previous phrase before indexing guarantees no immediate repeat when bank has at least two entries. [ASSUMED]

**When to use:** Loading rotations and repeated feedback events. For one-entry banks, return only entry. For empty banks, return `null`, never throw. [ASSUMED]

```typescript
export function selectSlang(
  entries: readonly string[],
  previous: string | undefined,
  random: () => number = Math.random,
): string | null {
  if (entries.length === 0) return null;
  const candidates = entries.length > 1
    ? entries.filter((entry) => entry !== previous)
    : entries;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}
```

Public helper may expose `getRandomSlang(context, locale, options?)`, but deterministic tests require injected RNG or exported pure selector. [ASSUMED]

### Pattern 4: Stable SSR Fallback, Client Preference Upgrade

**What:** Provider initializes `en`, reads validated locale in `useEffect`, then updates UI and `document.documentElement.lang`. Do not use `Math.random()` in render, lazy state initializers that run on server, or module-level slang selection. [ASSUMED]

**When to use:** Current app root has server-rendered `<html lang="en">` and client app providers. [VERIFIED: codebase]

### Pattern 5: Clear Copy Plus Personality Slot

**What:** Shared progress/result/empty components should receive or derive `title`, `description`, and optional `slang` separately. ARIA status should announce literal state, not rapidly changing jokes. [VERIFIED: `TASTE.md` product and accessibility rules]

**When to use:** `ConversionProgressShell`, quiz/flashcard progress cards, feedback panels, empty states, and done pages.

### Anti-Patterns to Avoid

- **One giant `t(key: string)` escape hatch:** Loses key safety and hides missing Vietnamese copy. Use typed domains/keys. [ASSUMED]
- **Replacing every English string with slang:** Violates clear-main-copy and safety contract. [VERIFIED: `TASTE.md`]
- **Random selection in component render:** Changes on unrelated re-renders, can repeat, and risks hydration mismatch. [ASSUMED]
- **Global single previous phrase:** Different contexts suppress unrelated valid text. Track previous phrase by `locale + context`. [ASSUMED]
- **Persisting random phrase history indefinitely:** Requirement only forbids consecutive repeats; session-memory refs are enough and avoid stale behavior. [ASSUMED]
- **Translating user/LLM/source content:** Questions, flashcard faces/backs, filenames, study-set titles, API error details, and canonical documents are content, not UI chrome. [VERIFIED: codebase domain model]
- **Changing routes for locale:** Explicit selector requirement does not require `/en` or `/vi` routes; route changes risk functionality. [ASSUMED]
- **Slang in destructive/delete dialogs or primary errors:** Explicitly banned. [VERIFIED: `TASTE.md`, dictionaries]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale preference state | Per-component local state | One `LocaleProvider` | Prevents inconsistent language and duplicate storage reads. [ASSUMED] |
| Cross-tab preference sync | Polling | Browser `storage` event | Existing project precedent. [VERIFIED: codebase] |
| Random test mocking everywhere | Global `Math.random` monkey patches | Injected RNG pure utility | Tests stay deterministic and isolated. [ASSUMED] |
| Runtime dictionary parsing | Markdown parser for dictionary files | Curated TypeScript catalogs derived during implementation | Markdown includes unsafe and easter-egg phrases requiring editorial classification. [VERIFIED: dictionaries] |
| HTML rendering for slang | `dangerouslySetInnerHTML` | Plain React text nodes | Slang is static copy; HTML adds needless XSS surface. [ASSUMED] |
| Translation of server/API errors by substring | Heuristic text replacement | Stable UI fallback keys plus optional safe technical detail | Error strings may include dynamic/server content and should remain accurate. [ASSUMED] |

**Key insight:** Complexity lies in governance, state timing, and coverage—not phrase selection. Central typed data and pure utilities prevent copy drift, unsafe placement, and nondeterministic UI.

## Integration Surface Inventory

### Provider and selector

- `src/components/layout/AppProviders.tsx`: wrap existing app shell with `LocaleProvider`; provider ordering must preserve deferred command-palette hydration note. [VERIFIED: codebase]
- `src/components/layout/AppTopBar.tsx`: account dropdown already exposes Settings and Log out; add explicit language entry or compact selector without changing trigger/layout. [VERIFIED: codebase]
- `src/app/(app)/settings/page.tsx`: preferred full selector surface; page currently has room for application preferences. [VERIFIED: codebase]
- `src/app/layout.tsx`: static `lang="en"`; document language must be synchronized after preference hydration under localStorage strategy. [VERIFIED: codebase]

### Shared high-leverage shells

- `src/components/processing/conversion-progress.tsx`: central progress title, subtitle, meta, step list, and ARIA labels. Add optional secondary slang slot here, but keep useful progress first. [VERIFIED: codebase and `TASTE.md`]
- `src/components/ui/sonner.tsx` plus direct toast call sites in import, canonical preview, and review components: translate at call site or provide typed toast-message helpers. [VERIFIED: codebase]
- `src/components/layout/CommandPalette.tsx`: navigation labels, headings, search placeholder, and empty result. [VERIFIED: codebase]

### Workflow surfaces

- Upload/ingest: `UnifiedInputZone.tsx`, `UploadBox.tsx`, `IngestProgressCard.tsx`, import workbench headers. [VERIFIED: codebase]
- Conversion/canonicalization: `CanonicalizeProgressCard.tsx`, source preview page, mode-selection footer, metadata chips. [VERIFIED: codebase]
- Generation: `QuizGenerateProgressCard.tsx`, `FlashcardGenerateProgressCard.tsx`, setup wizard and generation controls. [VERIFIED: codebase]
- Quiz feedback/results: `QuizSession.tsx`, quiz play page header, quiz done page. Existing correct/incorrect badges, score, retry, empty, and navigator ARIA labels all need literal locale coverage; slang should be separate feedback text. [VERIFIED: codebase]
- Flashcard session/results: `FlashcardSession.tsx`, interaction hints/actions, flashcard done page. Includes loading, empty, retry, front/back announcements, progress, navigation, and completion. [VERIFIED: codebase]
- Dashboard: `DashboardLibraryClient.tsx`, `DashboardStudySetCard.tsx`, library header, hero, stats row/home client, mobile nav, streak chip. Includes empty/filter-empty/loading, badges, streak and navigation. [VERIFIED: codebase]
- Review/edit: `ReviewSection.tsx`, `QuestionEditor.tsx`, review navigators, flashcard review workspace. Includes save/remove toast messages and secondary labels. [VERIFIED: codebase]
- Auth/settings: selector is allowed here, but slang must remain absent from login, logout, account, privacy-like, and configuration errors. [VERIFIED: `TASTE.md`]

### Planner sequencing recommendation

1. Foundation: types, catalogs, slang banks, selection/storage utilities, provider, unit tests.
2. Selector: account menu/settings integration and `document.lang` synchronization.
3. Shared shells: progress and toast patterns.
4. Pipeline: upload, conversion, canonicalization, quiz/flashcard generation.
5. Practice/results: quiz feedback, scores, retries, result screens, flashcard sessions.
6. Dashboard/navigation/review: empty states, badges, streaks, secondary labels, command palette.
7. Coverage audit: search remaining hard-coded user-facing strings, run typecheck/tests/build, manually switch locale across routes without reload. [ASSUMED]

## Common Pitfalls

### Pitfall 1: Hydration Mismatch from Stored Locale

**What goes wrong:** Server emits English while first client render emits Vietnamese, producing mismatch or flash. [ASSUMED]
**Why it happens:** localStorage is unavailable to server components. [ASSUMED]
**How to avoid:** Initial provider value must match server fallback; read storage in effect; no random slang before hydration. [ASSUMED]
**Warning signs:** hydration warnings, text changing before React settles, tests requiring `suppressHydrationWarning` on content nodes.

### Pitfall 2: Random Copy Changes on Every Render

**What goes wrong:** Feedback or loading joke changes when unrelated state updates. [ASSUMED]
**Why it happens:** `getRandomSlang()` called directly in JSX. [ASSUMED]
**How to avoid:** Select only on semantic events/context changes; retain result in state/ref. [ASSUMED]
**Warning signs:** phrase changes while typing, resizing, or progress repainting.

### Pitfall 3: Repeat Avoidance Fails at Small Banks

**What goes wrong:** infinite loops or undefined result when only one phrase exists. [ASSUMED]
**How to avoid:** filter previous only when length > 1; define empty behavior. [ASSUMED]
**Warning signs:** `while` loops around RNG or tests hanging.

### Pitfall 4: Slang Replaces Critical Meaning

**What goes wrong:** Users cannot identify state or recovery action. [VERIFIED: risk explicitly addressed by `TASTE.md`]
**How to avoid:** literal headline/action first; slang secondary and optional. Error/destructive/account/accessibility copy gets zero slang. [VERIFIED: project docs]
**Warning signs:** buttons named only “Lock in” or errors named only “Source sus.”

### Pitfall 5: Unsafe or Shaming Wrong-Answer Copy

**What goes wrong:** Phrases such as “skill issue,” “NPC answer,” “negative aura,” or identity-adjacent slang mock users. [VERIFIED: dictionaries classify these as teasing/negative]
**How to avoid:** curate allowlist; wrong-answer bank limited to gentle, non-ability-targeting support after explanation. [VERIFIED: `TASTE.md`]
**Warning signs:** direct second-person blame, insults, profanity, “Thô,” or repeated negative scoring jokes.

### Pitfall 6: Partial Locale Coverage

**What goes wrong:** Visible UI switches but ARIA labels, toasts, placeholders, command palette, progress steps, badges, and mobile navigation remain English. [VERIFIED: these strings exist across codebase]
**How to avoid:** migration checklist by context and compile-time catalog parity; final hard-coded-copy audit. [ASSUMED]
**Warning signs:** mixed language after selector change.

### Pitfall 7: Layout Regression from Vietnamese Length

**What goes wrong:** longer Vietnamese labels wrap controls, overflow badges, or shift navigation. [ASSUMED]
**How to avoid:** preserve geometry, prefer concise translations, test mobile widths, allow text wrapping only where current component supports it, never shrink touch targets. [VERIFIED: `TASTE.md` layout rules]
**Warning signs:** clipped dropdown items, badges wider than cards, primary action row wrap changes.

## Code Examples

### Locale Storage Boundary

```typescript
const LOCALE_KEY = "doc2quiz.locale";
const DEFAULT_LOCALE: Locale = "en";

export function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const value = window.localStorage.getItem(LOCALE_KEY);
  return value === "vi" ? "vi" : "en";
}
```

[ASSUMED] Key name is proposed; planner may align naming with existing localStorage constants.

### Provider Selection Boundary

```typescript
const lastByContext = useRef<Partial<Record<SlangContext, string>>>({});

const getRandomSlang = useCallback((context: SlangContext) => {
  const entries = slangCatalog[locale][context].map((entry) => entry.text);
  const next = selectSlang(entries, lastByContext.current[context]);
  if (next) lastByContext.current[context] = next;
  return next;
}, [locale]);
```

[ASSUMED] Clear `lastByContext` when locale changes, or key history by locale and context.

### Clear Loading Copy Composition

```typescript
<ConversionProgressShell
  title={t.progress.convertingTitle}
  subtitle={t.progress.convertingDescription}
  slang={slangLine}
  steps={localizedSteps}
/>
```

[ASSUMED] `slang` is new optional API; useful status remains primary and `aria-live` should announce stable literal title.

## State of the Art

| Old Approach in Project | Phase 6 Approach | Impact |
|-------------------------|------------------|--------|
| Hard-coded English JSX strings | Typed EN/VI catalogs | Explicit locale coverage and compile-time parity. [VERIFIED/ASSUMED] |
| No locale state | App-level provider with persisted preference | Immediate selector-driven updates across app. [ASSUMED] |
| No reusable slang engine | Context-keyed curated bank + no-repeat selector | Controlled reuse and deterministic tests. [ASSUMED] |
| Progress copy embedded per component | Shared literal/slang composition contract | Consistent clarity and personality. [ASSUMED] |

**Deprecated/outdated for this phase:**
- Direct hard-coded user-facing strings in migrated surfaces: replace with typed catalog access. [ASSUMED]
- Unclassified raw dictionary lines at runtime: dictionaries contain intentionally unsafe, teasing, coarse, and short-lived entries. [VERIFIED: project dictionaries]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | localStorage persistence is sufficient; cross-device locale sync is out of scope. | Summary / Architecture | Could require Supabase schema/profile work. |
| A2 | English is server and pre-hydration fallback. | Summary / SSR Pattern | Different default requires cookie/server integration. |
| A3 | No full i18n dependency is needed. | Standard Stack | Route localization or ICU requirements would change architecture. |
| A4 | Slang repeat history is session-memory and scoped by locale/context. | Architecture Patterns | Product may expect persistence across reloads or global non-repeat. |
| A5 | Static curated TypeScript data is manually derived from dictionaries. | Don't Hand-Roll | Automated dictionary generation would require build tooling and schema. |
| A6 | UI content, not user/source/generated study content, is translated. | Anti-Patterns | Translating generated content would require AI/data semantics beyond this phase. |

## Resolved Decisions

1. **Locale persistence:** Use validated browser `localStorage` only, with the existing `storage` event pattern for cross-tab synchronization. Do not add Supabase/profile persistence or cross-device account synchronization in Phase 6.

2. **Selector placement:** Provide the same EN/VI preference in both locations: a compact explicit selector in the account menu and a full labeled selector in Settings, backed by one `LocaleProvider`.

3. **Translation boundary:** Translate app-shell chrome and every Phase 6 listed-context UI surface, including visible labels, placeholders, progress, toasts, feedback, results, badges, navigation, warnings, empty states, streaks, scores, secondary labels, and matching accessibility labels. Preserve user, source, and generated study content unchanged: study-set titles, filenames, canonical documents/sections, MCQ stems/options/explanations, flashcard fronts/backs, and dynamic API technical detail are data, not product chrome.

4. **Slang rotation cadence:** Rotate only on semantic transitions such as context, workflow step, answer reveal, retry, success, or session completion. Do not add timer-based rotation; existing state transitions are the only cadence. Literal status remains stable and primary.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 [VERIFIED: codebase] |
| Config file | `vitest.config.ts` |
| Environment | Node; pure utility tests fit directly. Provider/component tests need DOM environment or should remain manual unless test setup expands. [VERIFIED/ASSUMED] |
| Quick run command | `npm test -- src/lib/locale` |
| Full suite command | `npm test -- --run` |

### Phase Behaviors → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Both locales contain same literal keys | unit/typecheck | `npm run typecheck` | ❌ Wave 0 |
| Every requested slang context exists for EN and VI | unit | `npm test -- src/lib/locale/slang.test.ts --run` | ❌ Wave 0 |
| Immediate repeat excluded when bank length > 1 | unit | `npm test -- src/lib/locale/selectSlang.test.ts --run` | ❌ Wave 0 |
| Empty and one-entry banks behave safely | unit | same | ❌ Wave 0 |
| Injected RNG produces deterministic boundary choices | unit | same | ❌ Wave 0 |
| Invalid stored locale falls back to EN | unit | `npm test -- src/lib/locale/localeStorage.test.ts --run` | ❌ Wave 0 |
| Selector persists and updates visible UI without reload | manual integration | Browser checklist | ❌ Wave 0 |
| Reload hydrates without warnings | manual integration/build | `npm run build` plus browser console | ❌ Wave 0 |
| Vietnamese copy preserves layout on mobile/desktop | visual/manual | Browser viewport checklist | ❌ Wave 0 |
| Errors/destructive/account/accessibility surfaces contain no slang | unit catalog policy + manual audit | `npm test -- src/lib/locale/slang.test.ts --run` | ❌ Wave 0 |

### Sampling Rate

- **Per task:** `npm run typecheck` plus focused locale test file.
- **Per wave:** `npm test -- --run`.
- **Phase gate:** `npm run lint && npm run typecheck && npm test -- --run && npm run build`, then manual EN/VI route matrix.

### Wave 0 Gaps

- [ ] `src/lib/locale/selectSlang.test.ts` — deterministic selection, no-repeat, edge cases.
- [ ] `src/lib/locale/messages.test.ts` — runtime parity/required key smoke checks where compile-time checks cannot cover arrays.
- [ ] `src/lib/locale/slang.test.ts` — all contexts populated, duplicate detection, forbidden tone/context rules.
- [ ] `src/lib/locale/localeStorage.test.ts` — validation and fallback through dependency-injected storage or minimal mock.
- [ ] Manual matrix covering account selector, settings, dashboard, import, conversion, both generators, quiz feedback/done, flashcard session/done, toast, command palette, mobile navigation.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no direct change | Keep auth behavior/copy literal; do not alter Supabase session logic. [VERIFIED: phase scope] |
| V3 Session Management | no direct change | Locale key contains no secret and must remain independent of auth cookies. [ASSUMED] |
| V4 Access Control | no direct change | Provider only affects presentation. [ASSUMED] |
| V5 Input Validation | yes | Validate stored locale against closed `"en" | "vi"` union; never trust arbitrary localStorage string. [ASSUMED] |
| V6 Cryptography | no | No sensitive data or cryptographic operation. [ASSUMED] |

### Known Threat and Content Patterns

| Pattern | STRIDE / Content Risk | Standard Mitigation |
|---------|------------------------|---------------------|
| Stored arbitrary locale value | Tampering / crash | Runtime allowlist and EN fallback. [ASSUMED] |
| Rendering slang as HTML | XSS | Static plain strings rendered as React text; no `dangerouslySetInnerHTML`. [ASSUMED] |
| User/source text passed into translation templates | Spoofing/content confusion | Translate UI chrome only; preserve content as data. [ASSUMED] |
| Shaming/hostile language | User safety | Curated allowlist; ban ability blame, identity targeting, sexual/racist/ableist/hostile terms. [VERIFIED: project docs] |
| Coarse slang in school/minor context | Appropriateness | Exclude all `Thô` entries by default. [VERIFIED: `Slang_Dictionary.md`] |
| Cultural appropriation/caricature | Content integrity | Use contemporary terms without caricaturing source communities; keep density low. [VERIFIED: `Slang_Dictionary.md` cultural note] |
| Fast-expiring memes | Product quality | Restrict `6-7`, Italian brainrot, similar content to rare optional easter eggs. [VERIFIED: project docs] |
| Slang in warning/error | Safety/usability | Literal warning/error first; only noncritical secondary warning line if clearly safe, never destructive/account/privacy/accessibility. [VERIFIED: `TASTE.md`] |

### Slang Appropriateness Boundaries

**Allowed:** loading companion copy, optional success/correct reactions, gentle retry support, empty-state captions, streak/score embellishment, badges, secondary navigation labels where literal label remains present. [VERIFIED: project docs]

**Restricted:** wrong-answer reactions must follow explanation, remain gentle, and avoid direct ability judgments. Warning slang may only follow an actionable literal warning. [VERIFIED: `TASTE.md`]

**Forbidden:** destructive confirmation, primary error text, privacy, payment, account recovery, authentication-critical instructions, accessibility instructions, profanity/coarse entries, identity-targeting language, sexual/racist/ableist/hostile language, and memes required to understand action. [VERIFIED: project docs]

## Project Constraints (from `.cursor/rules/`)

No `.cursor/rules/` directory exists in current workspace. [VERIFIED: codebase scan]

Additional binding project constraints from `TASTE.md`:

- Workflow clean; personality chaotic. [VERIFIED: project docs]
- Preserve clear primary actions and literal recovery instructions. [VERIFIED: project docs]
- 70% clear product language / 30% chaos by default; context-specific density caps apply. [VERIFIED: project docs]
- Preserve WCAG AA, keyboard behavior, reduced motion, layout order, and touch targets. [VERIFIED: project docs]
- No layout redesign is needed for Phase 6. [VERIFIED: user constraint]

## Sources

### Primary (HIGH confidence)

- `TASTE.md` — voice ratios, allowed placements, hard bans, accessibility and layout constraints.
- `dictionary/Brainrot_Slang.md` — canonical EN/VI phrase candidates and usage rules.
- `dictionary/Slang_Dictionary.md` — meanings, tone classifications, safety boundaries, density guidance.
- `src/components/layout/AppProviders.tsx` and `src/components/profile/DisplayNameProvider.tsx` — provider and localStorage precedent.
- `src/app/layout.tsx` — SSR root and static document language.
- `src/components/layout/AppTopBar.tsx`, `src/app/(app)/settings/page.tsx` — selector integration surfaces.
- `src/components/processing/conversion-progress.tsx` and generation progress cards — shared progress architecture.
- Quiz, flashcard, dashboard, review, import, toast, and command-palette source files — migration surface inventory.
- `package.json`, `vitest.config.ts`, existing `*.test.ts` files — stack and validation architecture.

### Secondary (MEDIUM confidence)

- None. External web research intentionally skipped because project dictionaries are canonical and no new package is recommended.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — uses existing verified project stack; no package additions.
- Architecture: HIGH — based on current provider, storage, SSR, and component composition patterns; localStorage-vs-cookie choice remains an explicit assumption.
- Integration surfaces: HIGH — identified directly from source.
- Content boundaries: HIGH — copied from canonical project taste/dictionaries.
- Pitfalls: MEDIUM — codebase evidence plus standard React hydration/testing reasoning marked `[ASSUMED]` where not runtime-verified.

**Research date:** 2026-07-26
**Valid until:** 2026-08-25
