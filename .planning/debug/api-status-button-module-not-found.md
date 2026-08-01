---
status: resolved
trigger: "Build Error: Module not found: Can't resolve '@/components/layout/ApiStatusButton' from AppTopBar.tsx"
created: 2026-07-30
updated: 2026-07-30
---

## Current Focus

hypothesis: AppTopBar imports ApiStatusButton but only ApiStatusIndicator exists on disk.
test: Add ApiStatusButton module re-exporting ApiStatusIndicator.
expecting: AppShell compile chain resolves without module-not-found.
next_action: Confirm dev/build progresses past AppTopBar.

## Evidence

- `AppTopBar.tsx` imports `@/components/layout/ApiStatusButton`.
- `ApiStatusIndicator.tsx` contains full AI status pill implementation; no `ApiStatusButton.tsx` file present.
- Historical work created ApiStatusButton then evolved into ApiStatusIndicator without updating the import alias file.

## Resolution

root_cause: Missing bridge module after component rename/refactor; import path stayed on ApiStatusButton.
fix: Created `src/components/layout/ApiStatusButton.tsx` re-exporting `ApiStatusIndicator`.
verification: Webpack should compile AppTopBar → AppShell → AppProviders.
files_changed:
  - src/components/layout/ApiStatusButton.tsx
