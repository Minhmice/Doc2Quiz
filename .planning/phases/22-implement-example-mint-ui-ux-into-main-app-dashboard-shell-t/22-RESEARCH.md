# Phase 22 — RESEARCH.md

**Status:** Complete (lightweight — project research disabled in config; this file satisfies planning traceability)

## RESEARCH COMPLETE

## 1. Stack constraints

- **Next.js 15** App Router + **Tailwind CSS v4** (`@import "tailwindcss"` in `globals.css`) + **shadcn-style** primitives under `src/components/ui/` (Base UI button, CVA variants).
- **Theme:** Semantic tokens live in `:root` / `.dark` in `src/app/globals.css`; wave 0 already remapped to Mint. Further UI work **must** use `bg-background`, `text-foreground`, `primary`, `muted`, `border`, `font-heading`, `font-label` — avoid hardcoding hex except where matching `example/` screenshots explicitly (then centralize in CSS variables).

## 2. Design references (repo)

| Mock | Path | Maps to app |
|------|------|----------------|
| Dashboard | `example/doc2quiz_action_focused_dashboard/code.html` | `/dashboard`, `DashboardLibraryClient`, `DashboardStatsWidget` |
| Settings | `example/doc2quiz_ai_connection_settings/code.html` | `/settings`, `AiProviderForm` |
| AI workspace | `example/refined_ai_processing_workspace/code.html` | `/sets/[id]/source` (embedded parse) |
| Review | `example/doc2quiz_professional_review_workspace/code.html` | `/sets/[id]/review` |
| Play | `example/doc2quiz_immersive_quiz_play_mode/code.html` | `/sets/[id]/play` |
| Atoms | `example/components-preview.html` | Buttons, cards, chips patterns |

## 3. Implementation strategy

1. **Wave 1 (22-01):** Dashboard hero + stats row + library cards — tonal cards, `font-label` microcopy, optional “action required” strip pattern from mock (without inventing new product logic; use existing draft/mistake signals only if data already exists).
2. **Wave 2 (22-02):** Settings page layout + `AiProviderForm` field styling (underline focus, section surfaces); polish study-set headers (`source`, `review`) spacing/typography toward workspace mock.

## 4. Risks

- **Contrast:** Coral `#ff967d` on light backgrounds — keep body text on `foreground` / `muted-foreground`, coral for accents only.
- **Keyboard UX:** No change to key handlers in play/review; layout-only refactors.

## 5. Verification commands

- `npm run lint`
- `npm run build`
