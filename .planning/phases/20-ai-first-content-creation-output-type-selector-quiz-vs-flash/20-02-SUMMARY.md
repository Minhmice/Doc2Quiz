# Phase 20 — Plan 02 summary (wave 2)

## Done

- **`src/components/ai/AiParseSection.tsx`:** `AiParseSurface` type; prop `surface` (default `"developer"`). Product mode: no top-level `AiParsePreferenceToggles`; strategy + estimate under **Advanced** `<details>`; softer OCR/chunk copy; vision-fallback summary hidden in product mode.
- **`src/app/(app)/sets/[id]/source/page.tsx`:** `Suspense` + `useSearchParams`; `surface` from `meta.contentKind` (quiz/flashcards ⇒ product); `?debug=1` shows `OcrInspector` / `QuestionMappingDebug`; post-parse redirect and overlay continue go to **`/sets/[id]/flashcards/review`** when `contentKind === "flashcards"`, else **`/review`**; empty state hints at `?debug=1`.
- **`src/components/ai/ParseResultOverlay.tsx`:** Optional **`continueLabel`** — flashcard sets use **“Review flashcards”**.
- **`src/app/(app)/dev/ocr/**`:** Lab layout 404 in production unless `NEXT_PUBLIC_ENABLE_DEV_OCR_LAB === "true"`; list + `[id]` pages compose existing parse-domain UI (no duplicate OCR engine).
- **`src/app/(app)/sets/[id]/flashcards/review/page.tsx`:** Draft `Question[]` as front/back with edit, save draft, remove.
- **`docs/ARCHITECTURE-domain-boundaries.md`:** Subsection **Product create flow vs dev OCR lab (`/dev/ocr`)**.

## Manual smoke (recommended)

- Dashboard → `/sets/new` → quiz path → source (no inspectors) → parse → `/sets/.../review`.
- Same with flashcards → `/sets/.../flashcards/review`; overlay CTA reads **Review flashcards**.
- Append `?debug=1` on source → inspectors visible.
- Dev: `/dev/ocr` works; prod build without flag → `/dev/ocr` 404.

## Verification

- `npm run lint` — pass  
- `npm run build` — pass  
