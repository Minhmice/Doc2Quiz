# Phase 17 — Plan 17-02 summary

**Wave:** 2 (parse UI)

## Delivered

- `src/components/ai/AiParseEstimatePanel.tsx` — Client panel with `aria-live="polite"` / `aria-atomic`, vision/chunk/fallback lines, duration range, token uppers, disclaimer.
- `src/components/ai/AiParseSection.tsx` — `estimateDocChars` / `estimatePageCount` from existing document-hint effect; `useMemo` → `estimateParseRun`; panel above `AiParseActions` when `!isEmbedded && hasKey && activePdfFile`; panel inside embedded controls when `hasKey && activePdfFile`.

## Verification

- `npm run lint` — exit 0
- `npm run build` — exit 0
