# Skill: Linear / Modern Dark (cinematic premium UI)

## When to use this skill

- User asks for **Linear-style**, **modern dark**, **cinematic**, **ambient glow**, **indigo accent**, **glass cards**, **spotlight hover**.
- Task touches **`components/themes/linear/**`**, **LinearButton / LinearCard / LinearInput**, or full-page layouts that rely on **blobs + grid + noise\*\* background.
- Building **bento grids**, **gradient headlines**, **parallax hero**, or **premium dev-tool** marketing.

**Handoff:**  
_Act as frontend-developer per `.cursor/agents/specialists/frontend-developer/SKILL.md`. Apply `.cursor/agents/skills/linear-modern-dark.md`. Scope: [files]._

---

## Role (agent mindset)

Expert FE + UI/UX + motion. **Before code:**

1. **Stack:** Next.js, Tailwind, `data-theme="linear-light"` / `linear-dark` (both share **same** cinematic token block in this repo), shells in `components/themes/linear/`.
2. **Depth is the product:** Layered backgrounds, soft borders (6–10% white), **multi-layer shadows**, **accent glow**—not flat `#000` slabs.
3. **Motion:** **200–300ms**, **`cubic-bezier(0.16, 1, 0.3, 1)`** (expo-out). Micro-moves **≤8px**, scale **0.98–1.02**. No bouncy springs for chrome.

---

## Design philosophy

| Principle                  | Meaning                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Near-black, not pure black | `#050506` canvas, `#020203` deepest layer                                                       |
| Off-white text             | `#EDEDEF` primary; `#8A8F98` muted                                                              |
| One accent                 | Indigo `#5E6AD2` → hover `#6872D9`; glow via `color-mix` / low-opacity radial                   |
| Atmospheric BG             | Grid + radial depth + noise + **animated blobs** (`::before`, `.bg-blob-2`) — see `globals.css` |
| Software feel              | Precise hover/focus; spotlight on cards; optional scroll parallax on hero                       |

**Differentiation from Bauhaus / Monochrome:** Soft depth, blur, gradients OK; **rounded-2xl** cards; **no** hard 4px offset shadows as default.

---

## Token mapping (RawVault)

**File:** `app/globals.css` → `:root[data-theme="linear-dark"]` & `linear-light` (identical block).

| Spec token      | Repo                                                     |
| --------------- | -------------------------------------------------------- |
| background-base | `--rv-bg` `#050506`, `--background` oklch ~0.18          |
| background-deep | `body` base `#020203` on `:root` linear                  |
| surface         | `--rv-surface` `rgba(255,255,255,0.05)`                  |
| surface-hover   | `--rv-surface-hover` 0.08                                |
| foreground      | `--rv-text` `#EDEDEF`                                    |
| muted           | `--rv-text-muted` `#8A8F98`                              |
| accent          | `--rv-primary` `#5E6AD2`, `--rv-primary-hover` `#6872D9` |
| border          | `--rv-border` `rgba(255,255,255,0.06)`                   |

**Typography (spec):** Inter + Geist. **Repo:** **Inter** on `--font-heading` / `--font-sans`; JetBrains Mono for mono. Add Geist in layout if spec requires.

**Radius:** `--rv-radius-lg` 16px, `--radius` 8px — cards **16px**, inputs/buttons **8px**.

---

## Background system (implemented + extensions)

**Already in CSS:**

1. **Base:** `#020203` + **64px grid** (2% white lines) + **radial ellipse** top (`#0a0a0f` → `#050506` → `#020203`).
2. **Noise:** `body::after` fixed overlay, low opacity.
3. **Blob 1:** `:root::before` — large blurred indigo circle, **`float` 10s**.
4. **Blob 2:** `.bg-blob-2` in DOM — purple-tinted blob, **12s reverse**.

**Marketing pages:** Ensure layout includes **`<div className="bg-blob-2" aria-hidden />`** (or equivalent) so secondary blob appears. Additional blobs = extra fixed divs + blur + slow animation.

**`prefers-reduced-motion`:** Reduce/disable blob animation and parallax when adding motion; keep contrast and focus states.

---

## Components — repo alignment

### LinearButton

- Primary: `bg-rv-primary`, multi-layer **accent glow** + **inset top highlight**; hover brighter shadow; **active `scale-[0.98]`**.
- Outline/secondary: translucent surface, hairline border, inset highlight.
- Ghost: muted → bright text on hover.
- Transition: **250ms** expo-out.

### LinearCard

- **Mouse-tracking spotlight:** 300px radial at cursor, accent at ~8% opacity on hover.
- Multi-layer shadow default → hover **stronger diffuse + accent glow**; **`hover:-translate-y-1`**.
- Inner: `bg-[var(--rv-surface)]` → `var(--rv-surface-hover)`; **`glass`** → backdrop-blur + more translucency.
- Wrapper uses **`rounded-[var(--rv-radius-lg)]`**.

### LinearInput

- Deep surface, `border-rv-border/60`; focus **`border-rv-primary`** + soft accent glow ring (no harsh outline-only).

---

## Shadows & glow (patterns)

Use **stacked** shadows: hairline border + soft black diffuse + optional **accent** outer glow. Example card baseline matches `LinearCard` classes.

Primary CTA: accent-tinted outer ring + inset white top edge (see `LinearButton` default).

---

## Layout & grids

- Section **`py-24`–`py-32`**; container + responsive padding.
- **Bento:** asymmetric spans (`col-span-2` / `3` / `4`), variable row heights—not uniform cards-only grids.
- Section dividers: `border-t border-white/6` or thin gradient line `via-white/10`.

---

## Typography treatments

- Display: **semibold**, **tracking-tight** / **-0.03em** on huge type.
- **Gradient text:** `bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent` for hero lines.
- Accent phrase: gradient `from-[#5E6AD2]` shimmer optional (respect motion prefs).

---

## Animation cheatsheet

| Use           | Timing              | Easing                             |
| ------------- | ------------------- | ---------------------------------- |
| Hover UI      | 200–300ms           | `cubic-bezier(0.16,1,0.3,1)`       |
| Blob float    | 8–12s               | ease-in-out infinite               |
| Entrance      | ~600ms stagger 80ms | expo-out                           |
| Hero parallax | scroll-driven       | reduce if `prefers-reduced-motion` |

---

## Anti-patterns (this aesthetic)

- Flat single-color page background (missing layers/blobs).
- **Pure #000** canvas and **pure #fff** body text at full brightness everywhere.
- Huge playful hover jumps; spring overshoot on cards.
- Thick white borders (keep **subtle**).
- Rainbow decoration—**indigo is the** accent.

---

## Accessibility

- **Focus:** accent ring visible; `ring-offset` on **near-black** bg (`ring-offset-background` or `#050506`).
- Contrast: `#EDEDEF` on `#050506` strong; muted text on dark—check **AA** for small labels.
- **Motion:** respect `prefers-reduced-motion` for blobs, parallax, stagger.

---

## Checklist

1. [ ] Background stack present (grid + radial + noise); blobs where marketing needs atmosphere.
2. [ ] Surfaces use **translucent** layers, not opaque gray slabs.
3. [ ] Shadows are **multi-layer** on elevated UI; primary buttons have **glow + inset highlight**.
4. [ ] Motion: expo-out, small deltas; reduced-motion path considered.
5. [ ] **linear-light** / **linear-dark** both tested (currently same look in CSS).

---

## Repo paths

| Area                | Path                                                  |
| ------------------- | ----------------------------------------------------- |
| Shells              | `components/themes/linear/{Button,Card,Input}.tsx`    |
| Tokens + BG + blobs | `app/globals.css` (THEME: LINEAR), `@keyframes float` |
| Theme switch        | `components/themes/index.tsx` → `case "linear"`       |

---

## Cross-reference

- **Theme plumbing:** `.cursor/agents/skills/theme-instructions.md`
- **Bauhaus / Monochrome:** different languages—do not mix hard-shadow or B&W rules here.

---

## Success

Feels like **Linear / Vercel / Raycast**: dark, expensive, cursor-responsive, soft light pools—not flat dark mode or colorful SaaS default.
