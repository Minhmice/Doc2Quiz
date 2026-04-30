# UX simplification — study set product split

## Decision (2026-04)

- **No content conversion** between multiple-choice practice (quiz) and flip study (flashcards). We do not turn approved questions into cards or cards into questions.
- **Route guards are allowed** (redirect when the URL does not match the set’s `contentKind`).

## Product rules

1. Do not ship “Convert to quiz” or “Convert to flashcards”.
2. Do not show conversion CTAs in the dashboard, editor, done page, command palette, or menus.
3. After creation, **`contentKind` is immutable** (not updatable via `touchStudySetMeta` or similar meta patches).
4. Wrong route → redirect to the canonical surface for that set:
   - Flashcard set on `/quiz/...` → `/flashcards/...` (and `/quiz/.../done` → `/flashcards/.../done`, etc., per `mismatchHrefForSurface` in `src/lib/routing/studySetContentKindRedirects.ts`).
   - Quiz set on `/flashcards/...` → `/quiz/...` (and analogous done/edit paths).
5. Legacy `/sets/:id/practice` resolves `contentKind` and sends users to `/quiz/:id` or `/flashcards/:id` (unset kind → quiz).

## Implementation map

- **Guards:** `useStudySetProductSurfaceRedirect` + `mismatchHrefForSurface`.
- **Legacy practice:** `PracticeLegacyRedirectClient` on `sets/[id]/practice` with surface `legacy-practice`.

## Manual verification

1. Create a **practice** set and open `/flashcards/<id>` — should redirect to `/quiz/<id>`.
2. Create a **flip study** set and open `/quiz/<id>` — should redirect to `/flashcards/<id>`.
3. Hit `/sets/<id>/practice` for each — should land on the correct play URL.
4. Open **done** and **edit** URLs for the wrong product — should redirect to the matching done/edit URL.

## Automated check

```bash
npx --yes tsx scripts/verify-study-set-redirects.ts
```
