---
name: Doc2Quiz
description: Turn study PDFs into structured quiz and flashcard sets
colors:
  oxblood-primary: "#5f0f00"
  coral-signal: "#ff967d"
  mint-paper: "#f7faf8"
  study-ink: "#181c1b"
  forest-sage: "#376757"
  deep-forest: "#00352d"
  mint-surface: "#ebefed"
  mint-muted: "#f1f4f2"
  mint-mist: "#baeed9"
  border-sage: "#c0c9c3"
  muted-ink: "#404945"
  destructive: "#ba1a1a"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Space Grotesk, ui-monospace, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "2.4px"
  md: "3.2px"
  lg: "4px"
  xl: "5.6px"
  card: "5.6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.oxblood-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  button-primary-hover:
    backgroundColor: "#841f06"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  button-outline:
    backgroundColor: "{colors.mint-paper}"
    textColor: "{colors.study-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.study-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.study-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
  card-default:
    backgroundColor: "#ffffff"
    textColor: "{colors.study-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  badge-default:
    backgroundColor: "{colors.oxblood-primary}"
    textColor: "#ffffff"
    rounded: "9999px"
    padding: "2px 8px"
---

# Design System: Doc2Quiz

## 1. Overview

**Creative North Star: "The Study Ledger"**

Doc2Quiz is a document-first study tool: users upload PDFs, the app structures the output into quizzes and flashcards, and the interface stays out of the way. The visual system reads like a precise ledger — mint-tinted paper, forest-green structure, oxblood authority for primary actions, coral for signals and focus rings. Nothing decorative for its own sake; every accent earns its place on a work surface.

Density is compact but breathable. The app shell uses a technical line grid (`d2q-technical-grid`) on `main` to signal "workbench" without turning the UI into a blueprint poster. Auth and marketing-adjacent surfaces may use ghost-dot grids sparingly; the default app experience is line-grid + flat surfaces.

The system explicitly rejects generic SaaS landing-page aesthetics, purple-gradient dark mode, glassmorphism-as-decoration, oversized pill cards, and uppercase eyebrow kickers on every section. Doc2Quiz is a tool you work in, not a template you scroll through.

**Key Characteristics:**

- Mint-paper backgrounds with forest-sage structure and oxblood primary actions
- Manrope for reading; Space Grotesk uppercase labels for instrument chrome
- Tight 4px base radius — precise, not playful
- Flat surfaces with 1px rings; shadows reserved for auth panels and elevated modals
- Technical grids opt-in on work surfaces, never as full-page wallpaper
- Light mode is the default design target; dark mode inverts to deep forest with coral signals

## 2. Colors

A mint-and-forest study palette with oxblood authority and coral feedback — committed accent use on controls and focus, restrained elsewhere.

### Primary

- **Oxblood Authority** (#5f0f00): Primary buttons, brand mark fill, chart emphasis. The heaviest color in the system; use for irreversible or main-line actions.
- **Coral Signal** (#ff967d): Focus rings (`--ring`), `d2q-accent`, hover emphasis in dark mode primary. Never a body background.

### Secondary

- **Forest Sage** (#376757): Secondary data emphasis, brand wordmark tint (`--d2q-blue`), chart-2. Structural green, not decorative fill.
- **Mint Mist** (#baeed9): Accent surface tint (`--accent`) with **Deep Forest** (#00352d) text. Use for highlighted panels or secondary containers, not full-page washes.

### Tertiary

- **Deep Forest** (#00352d): Accent-foreground, quiz-play tertiary token. Headline emphasis on auth aside ("Study mode, structured.").

### Neutral

- **Mint Paper** (#f7faf8): Page background (`--background`). Cool mint tint, not warm cream.
- **Study Ink** (#181c1b): Primary text (`--foreground`).
- **Muted Ink** (#404945): Secondary text (`--muted-foreground`). Must stay ≥4.5:1 on Mint Paper.
- **Mint Surface** (#ebefed): Secondary fills, elevated surface steps (`--secondary`).
- **Mint Muted** (#f1f4f2): Input backgrounds, subtle wells (`--muted`, `--input`).
- **Card White** (#ffffff): Card and popover surfaces.
- **Border Sage** (#c0c9c3): Borders and dividers (`--border`).
- **Destructive** (#ba1a1a): Errors and destructive actions.

### Named Rules

**The Coral-is-Signal Rule.** Coral (#ff967d) appears on focus rings, parse progress, and accent highlights — never as a page background or card fill. If coral covers more than ~10% of a screen, you've left the ledger.

**The Mint-Paper Rule.** Body backgrounds stay in the cool mint family (#f7faf8 light / #0c1a17 dark). Warm sand, cream, and parchment tones are prohibited in the app shell.

## 3. Typography

**Display Font:** Manrope (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Manrope (same stack — one family, weight contrast carries hierarchy)
**Label Font:** Space Grotesk (with ui-monospace, system-ui, sans-serif) via `font-label` utility

**Character:** Manrope is warm-geometric and highly legible at small sizes — right for dense study UIs. Space Grotesk labels read as instrument readouts: uppercase, tracked, authoritative. The pairing says "document tool," not "marketing site."

### Hierarchy

- **Display** (800, clamp(1.875rem, 4vw, 2.25rem), 1.15): Auth aside headlines, hero moments. Max one per viewport.
- **Headline** (700, 1.5rem / text-2xl, 1.25): Section titles, study-set names in chrome.
- **Title** (500, 1rem / text-base, 1.375): Card titles (`CardTitle`), dialog headers.
- **Body** (400, 0.875rem / text-sm, 1.625): Default reading text. Cap line length at 65–75ch in prose blocks.
- **Label** (700, 0.625rem / text-[10px], 0.08em tracking, uppercase): Section metadata, filter chips, progress labels, dashboard tabs. Use `font-label` — do not fake with Manrope + `uppercase`.

### Named Rules

**The Label-is-Instrument Rule.** Uppercase tracked labels are for wayfinding and status — dashboard filters, parse progress, flashcard session chrome. Never stack a label eyebrow above every section heading; one deliberate label per functional cluster is enough.

**The Display Ceiling Rule.** Hero/display text maxes at ~2.25rem (36px). Doc2Quiz is a tool; it does not shout.

## 4. Elevation

Flat-by-default with 1px rings. Depth is conveyed through surface steps (background → card → secondary/muted) and border contrast, not drop shadows. Cards use `ring-1 ring-foreground/10` instead of box-shadow stacks.

Shadows appear only where elevation is semantically required: auth form panels (`shadow-[0_24px_48px_-18px ...]`), quiz-play stitch surfaces (`--qp-card-shadow`), and interactive lift on study-session CTAs. Everywhere else, if you need separation, use a ring or a background step.

### Shadow Vocabulary

- **Auth panel lift** (`0 24px 48px -18px color-mix(foreground 12%, transparent)`): Login/signup card only.
- **Quiz-play ambient** (`0 40px 100px rgba(0, 53, 45, 0.06)`): Scoped to `[data-quiz-play-theme="stitch"]` cards.
- **Button press** (`active: translateY(1px)`): Tactile feedback on buttons — not a shadow.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Rings and tonal steps carry structure; shadows are a response to elevation context (auth, modal, play session), not default decoration.

**The No-Ghost-Card Rule.** Never pair `border: 1px solid` with a soft wide drop shadow (blur ≥16px) on the same element. Pick one structural device.

## 5. Components

Instrument-like, compact, and state-explicit. Built on shadcn `base-nova` + Base UI primitives.

### Buttons

- **Shape:** Tight corners (4px / `rounded-lg` mapped to `--radius-lg`), height 32px default (`h-8`)
- **Primary:** Oxblood fill, white text, `font-medium text-sm`. Hover: `bg-primary/80` (light) or coral shift (dark).
- **Hover / Focus:** `focus-visible:ring-3 ring-ring/50` with coral ring; `active:translate-y-px` press.
- **Outline:** Border-sage stroke, mint-paper fill, muted hover wash.
- **Ghost / Secondary / Destructive:** Muted hover surfaces; destructive uses 10% destructive tint, not solid red blocks.

### Chips

- **Style:** Badge component — pill (`rounded-4xl`), h-5, `text-xs font-medium`
- **State:** Primary fill for status; outline for filters; ghost for low-emphasis tags

### Cards / Containers

- **Corner Style:** `rounded-xl` (~5.6px) on shadcn Card; auth panels use `rounded-sm` (~2.4px) for form discipline
- **Background:** Card white on mint-paper; footer strip `bg-muted/50` with top border
- **Shadow Strategy:** Ring only (`ring-foreground/10`) — see Elevation
- **Border:** Prefer ring over border on cards; explicit `border-t` on card footers
- **Internal Padding:** 16px (`p-4`) default; 12px (`p-3`) on `size="sm"`

### Inputs / Fields

- **Style:** 32px height, `rounded-lg`, border-input stroke, transparent bg (light) / `bg-input/30` (dark)
- **Focus:** Coral ring (`ring-3 ring-ring/50`), border shifts to ring color
- **Error / Disabled:** Destructive border + ring at 20% opacity; disabled uses `bg-input/50` + `opacity-50`

### Navigation

- **AppTopBar:** Full-width chrome, z-40, compact controls, search input inline, avatar dropdown. No sidebar — horizontal wayfinding.
- **Typography:** Manrope for interactive text; `font-label` on create/filter affordances in dashboard.
- **Mobile:** Bottom nav (`DashboardMobileBottomNav`) for library; study routes drop chrome density.
- **Main canvas:** `d2q-technical-grid` on all app `main` surfaces.

### Parse Progress / Workbench (signature)

- **Style:** `font-label` uppercase status, chart-2 green for phase labels, shimmer/stripe animations on progress bars (`d2q-shimmer-overlay`, `d2q-progress-stripes`)
- **Behavior:** Animations respect `prefers-reduced-motion`; route enter uses `d2q-route-transition` (380ms ease-out)

## 6. Do's and Don'ts

### Do:

- **Do** use `d2q-technical-grid` on app `main` and full-width work canvases for workbench context.
- **Do** use `font-label` (Space Grotesk, 0.08em tracking, uppercase) for status, filters, and instrument metadata.
- **Do** keep primary actions oxblood (#5f0f00) and focus rings coral (#ff967d).
- **Do** use ring-1 (`ring-foreground/10`) on cards instead of drop shadows.
- **Do** cap body text contrast: Muted Ink (#404945) on Mint Paper, never lighter grays for readable copy.
- **Do** scope quiz-play stitch tokens to `[data-quiz-play-theme="stitch"]` — don't leak play-session colors into the library shell.

### Don't:

- **Don't** use warm cream, sand, beige, or parchment body backgrounds — the mint-paper cool tint is the brand surface.
- **Don't** add uppercase eyebrow kickers above every section heading — that's AI landing-page grammar, not ledger wayfinding.
- **Don't** use gradient text, glassmorphism, or decorative grid backgrounds on marketing-style hero sections inside the app.
- **Don't** exceed 4px base radius on structural containers — cards top out ~6px; pills are for badges/buttons only.
- **Don't** pair 1px borders with wide soft shadows on the same card — pick ring OR shadow, not both.
- **Don't** use side-stripe borders (`border-left` >1px colored accent) on cards, alerts, or list items.
- **Don't** animate layout properties for route transitions — opacity, transform, and filter only (`d2q-route-enter`).
