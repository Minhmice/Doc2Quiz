# Phase 14 — Plan 02 summary (wave 2)

## Done

- `MappingQualityBadge.tsx`: per-question Mapped / Uncertain / Unresolved badges with `title` tooltips from `mappingQuality` helpers.
- `QuestionCard.tsx`: badge beside `Q{n}` in header when **not** editing (per 14-02 plan).
- `QuestionPreviewList.tsx`: second badge next to “Draft *n*”.
- `ReviewSection.tsx`: amber-styled `Alert` when `countUncertainMappings(questions) > 0` with count and CTA to verify cards.
- `WORKFLOW-OCR-AI-QUIZ.md`: section 6 updated for `MAPPING` logs, toasts, and UI surfacing; file table lists `mappingQuality.ts`.

## Verification

- `npm run lint` — pass (same run as wave 1)
- `npm run build` — pass
