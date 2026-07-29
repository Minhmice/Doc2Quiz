# Phase 14 — UI design contract (mapping quality)

**Scope:** Parse summary affordances + review list **mapping quality** surfacing only. No full parse layout redesign.

## Mapping quality chip (per question)

**Surfaces:** `src/components/review/QuestionCard.tsx` (review) **and** `src/components/ai/QuestionPreviewList.tsx` (parse preview — same badge rules, beside the existing “Draft n” badge).

- **Placement:** Same row as question index label (`Q{n}`) or immediately under it; must not push primary actions (Edit / Remove) below fold on mobile.
- **Three states:**
  - **Mapped** — `mappingMethod` is set and not `unresolved`, and `mappingConfidence` is `undefined` or `>= 0.45` (aligned with `mappingQuality.ts`).
  - **Uncertain** — `mappingConfidence` defined and `< 0.45` but not `unresolved`, or `mappingMethod` is `vision_single_page` / heuristic-only per helper rules.
  - **Unresolved** — `mappingMethod === "unresolved"` or `mappingConfidence === 0` with unresolved.
- **Visual:** Use `Badge` from `src/components/ui/badge.tsx`: `Mapped` → `variant="secondary"`; `Uncertain` → `variant="outline"` + `border-amber-500/60 text-amber-950 dark:text-amber-100`; `Unresolved` → `variant="destructive"` or destructive outline. Match existing card typography (`text-xs`).
- **Tooltip:** `title` attribute or shadcn `Tooltip` if already in tree — show truncated `mappingReason` (max ~160 chars) + raw `mappingConfidence` / `sourcePageIndex` when present.

## Review page banner

- When `countUncertainMappings(questions) > 0`, show **one** `Alert` under page title / above list: neutral or warning tone, text includes **count** and CTA “Review page mapping in each card below.”
- Dismiss: not required for v1 (static on load); optional local dismiss is Claude's discretion.

## Parse summary (string)

- Append English clause: `· N question(s) with uncertain page mapping` when N > 0; keep existing summary prefixes (Vision / Layout-aware).

## Accessibility

- Chips must have discernible text (not color-only); tooltips are supplementary.

## Non-goals

- New routes, modals, or mapping editor — Phase 14 surfaces state only.
