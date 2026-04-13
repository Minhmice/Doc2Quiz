# Legacy Components Inventory

This folder stores components removed from the active runtime tree during the edit-centric restructure.

## Status Legend

- `migrated`: moved to a new active location and still used
- `archived`: moved to `src/components-legacy` and no active imports

## Rename / Move Map

| Original path | New path | Reason | Status |
|---|---|---|---|
| `src/components/sets/new/format-selection/*` | `src/components/edit/new/format-selection/*` | Rename from `sets` taxonomy to `edit` taxonomy | migrated |
| `src/components/sets/new/import/*` | `src/components/edit/new/import/*` | Rename from `sets` taxonomy to `edit` taxonomy | migrated |
| `src/components/sets/new/quiz/*` | `src/components/edit/new/quiz/*` | Rename from `sets` taxonomy to `edit` taxonomy | migrated |
| `src/components/sets/new/flashcards/*` | `src/components/edit/new/flashcards/*` | Rename from `sets` taxonomy to `edit` taxonomy | migrated |
| `src/components/practice/PlaySession.tsx` | `src/components/quiz/QuizSession.tsx` | Normalize runtime naming from `practice/play` to `quiz` | migrated |
| `src/components/upload/PdfInfoCard.tsx` | `src/components-legacy/upload/PdfInfoCard.tsx` | Unused old component archived to reduce active component surface | archived |
| `src/components/viewer/RawTextViewer.tsx` | `src/components-legacy/viewer/RawTextViewer.tsx` | Unused old component archived to reduce active component surface | archived |

## Archived Components (do not import in runtime)

- `src/components-legacy/upload/PdfInfoCard.tsx`
- `src/components-legacy/viewer/RawTextViewer.tsx`

If you need to restore an archived component, move it back under `src/components/` and add explicit active usage in route or feature modules.
