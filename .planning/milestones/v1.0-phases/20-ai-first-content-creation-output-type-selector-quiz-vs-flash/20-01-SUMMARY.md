# Phase 20 — Plan 01 summary (wave 1)

## Done

- **`src/types/studySet.ts`:** `StudyContentKind` (`"quiz" | "flashcards"`), optional `contentKind` on `StudySetMeta`.
- **`src/lib/db/studySetDb.ts`:** `createStudySet` accepts optional `contentKind`; `touchStudySetMeta` allows updating `contentKind`.
- **`src/app/(app)/sets/new/NewStudySetPdfImportFlow.tsx`:** Shared PDF import (props: `contentKind`, `getPostCreateHref`, headings, optional `titlePrefix`).
- **`src/app/(app)/sets/new/page.tsx`:** Selector only — links to `/sets/new/quiz` and `/sets/new/flashcards` with clear titles / `aria-label`s.
- **`src/app/(app)/sets/new/quiz/page.tsx`** & **`flashcards/page.tsx`:** Thin wrappers with correct copy and navigation to `/sets/[id]/source`.
- **Global chrome:** `DashboardLibraryClient`, `AppTopBar`, and `CommandPalette` still link to **`/sets/new`** only (selector entry).

## Verification

- `npm run lint` — pass  
- `npm run build` — pass  
