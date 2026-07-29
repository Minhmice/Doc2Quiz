---
phase: 08
slug: flashcards-mode
status: approved
shadcn_initialized: true
preset: base-nova
created: 2026-04-11
reviewed_at: "2026-04-11"
---

# Phase 08 — UI Design Contract

> Visual and interaction contract for **Flashcards mode** on **`/sets/[id]/flashcards`**. Align with **`08-CONTEXT.md`** (D-01–D-10), shipped **Quiz** route (`/sets/[id]/play`, `PlaySession.tsx`), **`StepProgressBar`**, and **`globals.css`** / shadcn **base-nova** (same stack as Phase 05).

**Sources:** `.planning/phases/08-flashcards-mode/08-CONTEXT.md`, `docs/BACKLOG-flashcards.md`, `.planning/ROADMAP.md` Phase 8, `.planning/PROJECT.md`, `src/app/(app)/sets/[id]/play/page.tsx`, `src/components/play/PlaySession.tsx`, `src/components/layout/StepProgressBar.tsx`, `.planning/phases/05-score-repeat/05-UI-SPEC.md`, `src/app/globals.css`, `components.json`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova (`components.json` — Next.js App Router, Tailwind v4, `src/app/globals.css`) |
| Component library | Radix primitives via shadcn/ui (base registry) |
| Icon library | lucide-react |
| Font | Page `h1`: **`font-[family-name:var(--font-display)]`** (match **Take quiz · …** on `play/page.tsx`). Card body: **`--font-sans` / body** stack. Muted hints: default sans, **`text-muted-foreground`**. |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps between icon + label in hints |
| sm | 8px | Tight stacks (title ↔ subtitle), badge padding |
| md | 16px | **`CardContent`** / **`CardHeader`** padding (`p-4` / `px-6` family — stay consistent with `PlaySession` card) |
| lg | 24px | Page header block **`mb-6`** (match play page) |
| xl | 32px | Space between progress strip and main card when both shown |
| 2xl | 48px | Rare — only if a two-column layout is introduced later |
| 3xl | 64px | Page max-width gutters — not required for v1 |

**Exceptions:** Minimum **44px** height for any standalone **Previous card** / **Next card** buttons if shown as full buttons (touch). Card face min height **200px** on `sm+` so empty stems do not collapse awkwardly (soft minimum — executor may use `min-h-[12rem]`).

---

## Typography

**Contract uses exactly four pixel sizes and two weights** (checker gate).

| Role | Size | Weight | Line height |
|------|------|--------|--------------|
| Label | 12px | 600 | 1.35 |
| Body | 16px | 400 | 1.5 |
| Heading | 20px | 600 | 1.2 |
| Display | 32px (`sm:` and up) | 600 | 1.1 |

**Hierarchy without a third weight:** Use **size** (Display vs Heading vs Body), **`tracking-tight`** on Display, and **color** (`text-foreground` vs `text-muted-foreground`) for de-emphasis — not heavier than **600**.

**Page `h1`:** Below `sm`, use **Heading** (20px / 600). From **`sm:`** upward, use **Display** (32px / 600). Do **not** introduce an intermediate **24px** title tier — keeps the four-size contract intact (play may still use different utilities; **flashcards** title must map to these two roles only).

**Card face text (stem + answer):** **Body** only (16px / 400). Long stems: **`line-clamp-[6]`** or scroll inside card — **executor picks one**; do not introduce additional named pixel tiers.

**Progress / counter:** **Label** style, **`tabular-nums`**, muted — e.g. `Card 3 of 12`.

---

## Color

Map to **semantic tokens** (`globals.css` / Tailwind shadcn theme). Align with **Phase 05** / **PlaySession**: indigo **primary** for actions and rings; **no** destructive styling for ordinary flip/back face.

**Approximate 60 / 30 / 10:** **~60%** page canvas **`--background`**; **~30%** elevated surfaces **`--card`**, **`--secondary`**, borders; **~10%** accent **`--primary`** / **`--ring`** (CTAs, focus, key links only).

| Role | Token / pattern | Usage |
|------|-----------------|--------|
| Dominant | `--background` | Page canvas |
| Card surface | `--card`, `text-card-foreground` | Main flashcard **`Card`** + `shadow-lg` (same family as in-progress quiz card) |
| Secondary | `--secondary`, `--border` | Subtle inner borders, muted strips |
| Accent | `--primary`, `--ring` | Focus ring on session root, **Take quiz** as default-style link/button, keyboard-focus visible states |
| Muted copy | `--muted-foreground` | Hints, progress, “Press Space …” |
| Error / destructive | `--destructive`, `Alert variant="destructive"` | **Load failures** and hard errors only — not card “wrong” states (N/A in flashcards v1) |
| Back face distinction | Optional **`bg-secondary/40`** or **border-t** separator — **subtle** only; must maintain **WCAG contrast** for text on both faces |

**Accent reserved for:** Primary navigation (**Take quiz**), focus rings, optional **Next card** emphasis — **not** the entire card background.

---

## Page layout & regions

**Route:** `src/app/(app)/sets/[id]/flashcards/page.tsx` (client inner + `Suspense` boundary — **mirror `play/page.tsx`** pattern).

**Visual hierarchy (focal order):** The **primary anchor** is the large **`Card`** (`shadow-lg`) showing the current question or answer. The user’s eye hits **second** the page **`h1`**, then **tertiary** elements: cross-links row, then progress strip — keep **`h1`** visually strong but **card remains the study focal point**.

**Structure (top → bottom):**

1. **Page header** (same column width / rhythm as play)
   - **`h1`:** **Flashcards · {study set title}** (fallback **…** while loading — match play headline behavior).
   - **Optional** one line: subtitle / source file name — **only if** play page shows them for the same meta; keep parity.
   - **Muted hint line:** Use **Label** typography (**12px / 600**, e.g. Tailwind **`text-xs`**, **`text-muted-foreground`**) — **do not** use **`text-sm`** (~14px); that would break the four-size contract. Copy: **Space** flips the card. **Left arrow** / **Right arrow** move to the previous or next card. (Adjust wording if executor uses **Up/Down** instead — CONTEXT allows arrows; **lock copy to match implemented keys**.)

2. **Entry / cross-links row** (below hint, above card)
   - **`Link`** (or `Button variant="link"`) **Take quiz** → **`/sets/{id}/play`**.
   - Optional **`Link`** **Review questions** → **`/sets/{id}/review`** (same as dead-end recovery paths elsewhere).

3. **Session root** (keyboard target)
   - Wrapper with **`tabIndex={0}`**, **`role="region"`**, **`aria-label="Flashcard study"`** (or **“Flashcards for {title}”** if title available without flash of wrong name).
   - **`outline-none focus-visible:ring-2 focus-visible:ring-ring`** on focus.
   - **`useEffect`:** on mount, **`requestAnimationFrame`** then **`focus()`** once meta + bank ready so **Space** works without click (**08-CONTEXT D-07**).

4. **Progress strip** (optional but recommended)
   - One line **Label** + **`tabular-nums`**: **Card {current+1} of {total}** **or** thin **`Progress`** (`@/components/ui/progress`) with value = `(index+1)/total*100` — **pick one** for v1 and stay consistent.

5. **Main `Card`** (`shadow-lg`)
   - **`CardHeader`** (optional): static title **Question** / **Answer** is **not** required — prefer a single card body without redundant headings unless a11y review demands visible labels; use **`aria-roledescription`** / live region instead.
   - **`CardContent`:** Face content (see **Front / back** below).
   - **`CardFooter`** (optional): duplicate **Previous card** / **Next card** as **`Button variant="outline"`** for mouse users — **mirror** play’s on-screen nav pattern if play exposes prev/next; if omitted, document that **arrows-only** is acceptable only if hint copy states arrows clearly.

**Step progress bar (`StepProgressBar`):** Treat **`/flashcards`** as part of the **“study after review”** band: extend **`currentStepFromPathname`** so pathname containing **`/flashcards`** returns the same step id as **`/play`** (**`play`**). **Do not** add a fifth numbered step for v1. **“3. Quiz”** link still targets **`/play`**; users reach flashcards via header cross-link or command palette — avoids roadmap explosion.

---

## Front / back content (derived from `Question`)

**Front (not flipped):**

- **Stem** text: `question` string — **Body** typography, respect line clamp / scroll decision above.
- **Image:** If `questionImageId` set, render image via same **blob URL** pattern as **`MediaImage`** in `PlaySession` (max height **~192px**, rounded border, **`alt=""`** decorative unless future copy provides stem alt — v1 **`alt=""`** acceptable for parity with play).

**Back (flipped):**

- **Correct option text:** `options[correctIndex]` — **Body**.
- **Image:** If `optionImageIds?.[correctIndex]` present, show second **`MediaImage`** block below or beside text with same constraints as front.

**Flip interaction:**

- **Space** toggles flipped state; **`preventDefault`** on **`keydown`** when session root is focused and key is Space, to avoid **page scroll**.
- Visual: **instant content swap** **or** **CSS opacity/transform** under **200ms** — executor choice; must not block input for **>300ms**. No 3D flip that harms readability on low-end devices unless performance-checked.

**State reset:** When card index changes, **flipped** returns **`false`** before paint (08-CONTEXT D-08).

---

## Keyboard & accessibility

| Key | Action |
|-----|--------|
| **Space** | Toggle front/back (only when region focused and not in loading/error) |
| **ArrowLeft** | Previous card (clamp at 0 — no wrap) |
| **ArrowRight** | Next card (clamp at last — no wrap) |

**Screen reader:**

- Announce face change: container **`aria-live="polite"`** with short text **Front** / **Answer** (or **Question** / **Answer**) when flip toggles — debounce duplicate fires if needed.
- **`aria-busy="true"`** on region during bank load.

**Focus order:** Session root → primary **Take quiz** link in header (if in tab order) — prefer session root **first** on load per D-07; footer buttons after card in DOM order.

---

## Edge & empty states

| Scenario | UI |
|----------|-----|
| **Loading meta / bank** | **Label** line (**12px / 600**, e.g. **`text-xs text-muted-foreground`**), **`role="status"`**, **Loading…** — if play uses **`text-sm`**, flashcards spec **overrides** to stay within the four-size contract |
| **Load error** | **`Alert variant="destructive"`** — title **Error**, body from exception or **Could not load flashcards.** + **Open library** or **Review** link |
| **Empty bank** (no approved MCQs) | Mirror **`PlaySession`** empty quiz: **`Alert`** orange/warning treatment — title **No approved questions for a quiz yet.** (or flashcard-specific **No approved questions yet.**) + body **Approve complete MCQs on Review first** + **`Link` to `/sets/{id}/review`** — **same tokens** as play empty state |
| **Single card** | Arrows no-op at bounds; progress shows **1 of 1** |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page `h1` prefix | **Flashcards ·** |
| Keyboard hint (default) | **Space** flips the card. **Left arrow** and **right arrow** move between cards. |
| Cross-link to quiz | **Take quiz** |
| Cross-link to review | **Review questions** |
| Progress | **Card {n} of {total}** |
| Region aria-label | **Flashcard study** (or **Flashcards** + set title when stable) |
| Live region on flip | **Question** / **Answer** (English, short) |
| Empty bank title | **No approved questions yet.** (or match play string for consistency — **pick one** and use in both routes’ empty helpers if shared) |
| Empty bank body | **Approve complete MCQs on Review first (stem, four options, correct answer).** |
| Error alert body | **Could not load flashcards.** + recovery path |

---

## Registry Safety

| Registry | Blocks used | Safety gate |
|----------|-------------|-------------|
| shadcn official (`components.json`, `registries: {}`) | **`card`**, **`button`**, **`alert`**, **`progress`** (if used), **`separator`** (optional), **`badge`** (optional for “Front/Back” chip) | Official registry — **view not required** for v1 |
| Third-party | **none** | n/a |

**Do not** add non-shadcn animation libraries for flip unless product later mandates; prefer CSS + Tailwind.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-11 (gsd-ui-checker — six dimensions; typography tightened after revision: no `text-sm` for hint/loading; four sizes / two weights)
