# Phase 22 — Mint UI/UX from `example/` into main app

## North star

Ship the **architectural / Mint** look from `example/*/code.html` and `example/mint_architecture/DESIGN.md` into the Next app: tonal surfaces, forest + coral accent, sharp radius, Manrope + Space Grotesk, blueprint grid where appropriate — **without** breaking keyboard-first practice or parse flows.

## Source of truth (repo)

- Tokens & atoms: `example/components-preview.html`
- Full pages: `example/doc2quiz_*/code.html`, `example/refined_ai_processing_workspace/code.html`
- Principles: `example/mint_architecture/DESIGN.md` (no-line rule, tonal layering)

## Wave 0 (landed without full plan — bootstrap)

- Global CSS semantic colors → Mint light/dark
- Root fonts → `Manrope` + `Space_Grotesk` (`--font-body`, `--font-label`)
- `font-heading` = Manrope; `@utility font-label` for uppercase technical labels
- `AppTopBar`, `AppShell` main canvas, `StepProgressBar` visual alignment
- Replace ad-hoc `font-[family-name:var(--font-display)]` with `font-heading`

## Next (run `/gsd-plan-phase 22` when ready)

- Dashboard cards / stats widget → closer to `doc2quiz_action_focused_dashboard`
- Settings + forms → `doc2quiz_ai_connection_settings` (underline inputs, coral focus)
- Review / play / flashcards screens — page-by-page parity with mocks
- Optional: `next/font` subset optimization, reduced motion for blueprint grid

## Acceptance (draft)

- Light + dark themes readable; primary actions meet contrast on `#5f0f00` / `#ff967d`
- No regression: `/sets/[id]/play` keyboard map, `/sets/[id]/source` parse CTA still obvious
- `npm run build` + `npm run lint` pass
