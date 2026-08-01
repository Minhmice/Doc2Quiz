---
status: verifying
trigger: "Debug local Doc2Quiz: user cannot see Appearance/theme options in Settings (screenshot shows only Application, a weird duplicated 'Tây' section, support, export). Inspect active Settings page route/component tree, recent AppearanceSettings additions, server/client rendering guards, layout/locale, CSS visibility, current git state. Apply minimal fix so theme selector visibly renders in Settings. Preserve unrelated dirty work, no commit. Run typecheck and focused tests/lint. Return root cause, files, checks."
created: 2026-07-31T21:55:00+07:00
updated: 2026-07-31T21:59:00+07:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Settings page omits AppearanceSettings because page.tsx still renders legacy controls and never mounts that component."
  confirming_evidence:
    - "The active Settings route in page.tsx contains LanguageSelector, support copy, and export button only."
    - "AppearanceSettings exists and renders five visible radio-button choices, but its only importer is unused SettingsPageClient."
    - "AppRootProviders mounts ThemePreferenceProvider above app routes, so no provider guard blocks AppearanceSettings."
  falsification_test: "If AppearanceSettings were imported and mounted by page.tsx already, or CSS hid the mounted fieldset, route omission would be false."
  fix_rationale: "Mounting AppearanceSettings in active page.tsx places selector in rendered route while retaining legacy Settings layout and unrelated content."
  blind_spots: "Browser-authenticated visual check unavailable; typecheck, lint, and targeted tests cannot prove production layout rendering."
hypothesis: Active Settings page route omits AppearanceSettings.
test: Add one import and one settings-card mount, then typecheck, lint, and run theme preference tests.
expecting: Theme selector compiles as visible route content; focused checks pass.
next_action: Add AppearanceSettings card to active Settings route.

## Symptoms

expected: Settings visibly provides Appearance/theme selection.
actual: Screenshot shows Application, duplicated civilization choices, support notice, and data export; no Appearance/theme options.
errors: None reported.
reproduction: Open local Doc2Quiz Settings page while signed in.
started: Present in current local dirty working tree; prior working state unknown.

## Eliminated

## Evidence

- timestamp: 2026-07-31T21:55:00+07:00
  checked: Reporter screenshot
  found: Settings page is rendered but lacks Appearance/theme section.
  implication: Likely component composition, conditional rendering, or CSS visibility rather than routing failure.

- timestamp: 2026-07-31T21:56:00+07:00
  checked: src/app/(app)/settings/page.tsx and SettingsPageClient.tsx
  found: Active page.tsx renders only LanguageSelector, support text, and ApprovedBankExportButton. SettingsPageClient imports and renders AppearanceSettings but page.tsx never uses it.
  implication: Route composition, not CSS or provider behavior, directly explains missing Appearance section.

- timestamp: 2026-07-31T21:58:00+07:00
  checked: AppearanceSettings, ThemePreferenceProvider, AppRootProviders, and globals.css
  found: AppearanceSettings returns a normal visible fieldset with five buttons; ThemePreferenceProvider wraps all routes; no matching global CSS hides it.
  implication: Server/client provider and CSS visibility hypotheses are disproved.

- timestamp: 2026-07-31T22:01:00+07:00
  checked: Route change and focused validation
  found: page.tsx now mounts AppearanceSettings. TypeScript check, route ESLint, and themePreference tests passed.
  implication: Selector is in active rendered component tree and checked code compiles cleanly.

## Resolution

root_cause: Active Settings route (src/app/(app)/settings/page.tsx) retained legacy language/support/export markup and never mounted AppearanceSettings. SettingsPageClient contained the newer AppearanceSettings composition but had no caller.
fix: Imported AppearanceSettings and rendered it in its own existing settings card ahead of LanguageSelector.
verification: npm run typecheck passed; npx eslint src/app/(app)/settings/page.tsx passed; npx vitest run src/lib/profile/themePreference.test.ts passed (2 tests).
files_changed: [src/app/(app)/settings/page.tsx]
