# Phase 22 — UI-SPEC (Mint / blueprint)

**Source:** `example/mint_architecture/DESIGN.md`, `example/components-preview.html`, page mocks listed in `22-CONTEXT.md`.

## Global

- **Typography:** Headlines `font-heading` (Manrope). Micro labels (section kicker, chip caps) `font-label` (Space Grotesk, uppercase, wide tracking).
- **Radius:** Prefer `rounded-sm` / `rounded-md` over pills for structural chrome (step bar, top bar logo). Cards may use `rounded-lg` only when mock shows softer deck tiles.
- **Surfaces:** Prefer `bg-card`, `bg-muted/30`, `border-border` — avoid heavy 1px section boxing; use tonal shift (DESIGN “no-line” rule) where feasible.
- **Accent:** Primary actions `bg-primary text-primary-foreground`. Secondary emphasis / “Study partner” stripe uses coral `#ff967d` via token `ring` / explicit class only where already pattern-established in `AppTopBar`.

## §1 Dashboard (`/` → `/dashboard`)

- **Header:** Title “Library” + one-line muted description (keep copy meaning; may shorten).
- **Stats row:** Four visual columns feel: (1) sets w/ approved bank, (2) streak, (3) weekly chart, (4) optional placeholder OR “action” card — **22-01** implements layout; data stays truthy from existing hooks.
- **Empty state:** Dashed tonal panel + single primary CTA → `/sets/new` (not legacy upload copy if inconsistent with funnel).
- **Deck cards:** Top gradient strip (keep `DECK_ACCENTS` hues but shift toward forest/indigo-coral harmony); footer actions remain keyboard-friendly links.

## §2 Settings (`/settings`)

- **Page shell:** Title + description + single elevated panel (`rounded-2xl` allowed here per existing page — may tighten to `rounded-xl border border-border bg-card`).
- **Form:** Inputs mimic mock “drafting pencil” — bottom border focus `border-primary`, minimal outer border; labels use `font-label` + `text-muted-foreground`.

## §3 Study set — Source / Review (surface only in 22-02)

- **Headers:** Consistent `h1` + optional subtitle + `text-xs` source line; spacing `space-y-6` alignment with mock vertical rhythm.
- **No change** to parse orchestration logic in this phase beyond presenter classes.

## Accessibility

- Search input keeps `aria-label`; focus rings use `ring-ring`.
- Color-only status must retain text label (draft / approved badges).
