---
status: resolved
trigger: "Build Error: Module not found: Can't resolve '@/lib/profile/profileValidation' from api/profile/route.ts"
created: 2026-07-30
updated: 2026-07-30
---

## Resolution

root_cause: `profileValidation.ts` was implemented during profile work but never committed; `api/profile/route.ts` still imports `validateProfileText`.
fix: Restored `src/lib/profile/profileValidation.ts` with image/text validators; text validation skips undefined fields so partial PATCH updates work.
files_changed:
  - src/lib/profile/profileValidation.ts
