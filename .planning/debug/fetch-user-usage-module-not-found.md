---
status: resolved
trigger: "Build Error: Module not found: Can't resolve '@/lib/client/fetchUserUsage' from AppSidebar.tsx"
created: 2026-07-30
updated: 2026-07-30
---

## Current Focus

hypothesis: Phase 8 freemium client helpers were implemented but never committed; imports remained in AppSidebar/AppProviders.
test: Restore `fetchUserUsage.ts` and `apiResponse.ts`, rebuild.
expecting: Next.js dev/build resolves `@/lib/client/fetchUserUsage` without module-not-found.
next_action: Verify `npm run dev` / compile succeeds.

## Evidence

- `src/lib/client/fetchUserUsage.ts` absent from workspace; grep shows imports in `AppSidebar.tsx`, `AppProviders.tsx`, `SettingsPageClient.tsx`.
- `src/lib/client/apiResponse.ts` also absent; required by `friends.ts` and `workspaceCollaboration.ts`.
- `GET /api/usage` route exists and returns flat `UserUsage` JSON.

## Resolution

root_cause: Missing client module files referenced by layout shell after Phase 8/10 work landed without the supporting `src/lib/client/*` artifacts.
fix: Recreated `fetchUserUsage.ts` (client fetch + `UserUsage` type + usage-updated helper) and `apiResponse.ts` (`parseApiError`). Updated `AppSidebar` to use `messages.plan.remainingUsage` instead of removed `freeUsage`.
verification: Targeted compile path via dev server / build.
files_changed:
  - src/lib/client/fetchUserUsage.ts
  - src/lib/client/apiResponse.ts
  - src/components/layout/AppSidebar.tsx
