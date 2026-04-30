# Skill: Bauhaus (Constructivist design system)

## When to use this skill

- User asks for **Bauhaus**, **constructivist**, **primary colors** (red/blue/yellow), **hard shadows**, **geometric** UI.
- Task touches **`components/themes/bauhaus/**`**, **BauhausButton / BauhausCard / BauhausInput\*\*, or marketing/layout that must match this preset.
- Refactoring components to **color blocks**, **thick black borders**, **mechanical press** interactions.

**Handoff:**  
_Act as frontend-developer per `.cursor/agents/specialists/frontend-developer/SKILL.md`. Apply `.cursor/agents/skills/bauhaus-theme.md`. Scope: [files]._

---

## Role (agent mindset)

Expert FE + UI/UX + typography. **Before code:**

1. **Stack (RawVault):** Next.js, Tailwind v4, `data-theme="bauhaus-light"` / `bauhaus-dark`, tokens in `app/globals.css`, shells in `components/themes/bauhaus/`, `useThemeComponents()` when `themeName === "bauhaus"`.
2. **Tokens:** Use **`bg-primary` / `bg-secondary` / `bg-accent`** (red / blue / yellow), **`border-border`** / **`--rv-border`** (black/white by mode), **`bg-background`**, **`text-foreground`**, **`bg-rv-surface`**, **`text-rv-text`**. Avoid random hex when semantic tokens match (`#D02020` ≈ `primary`, etc.).
3. **Personality:** No soft blurred shadows—only **offset hard shadows**. No gradients for chrome. **Mechanical** motion (ease-out, short duration).

---

## Design philosophy

| Idea                  | Implementation                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Form follows function | Clear hierarchy; geometric decoration with purpose                                       |
| Primary triad         | Red `#D02020`, Blue `#1040C0`, Yellow `#F0C020` + black `#121212` / off-white canvas     |
| Hard depth            | `4px_4px_0px_0px` style shadows—layering, not blur                                       |
| Thick structure       | `border-2`–`border-4` black (light) / light border (dark mode tokens)                    |
| Constructivist type   | Uppercase headlines, **black (900)** / **bold (700)** display; tight leading on display  |
| Radius binary         | **`rounded-none`** OR **`rounded-full`**—avoid `rounded-md` for Bauhaus-branded surfaces |

**Vibe:** Constructivist, geometric, modernist, bold, architectural—not generic Bootstrap cards.

---

## Token mapping (RawVault)

Defined in **`app/globals.css`** under `:root[data-theme="bauhaus-light"]` and `bauhaus-dark`.

| Spec / concept      | Light (CSS) | Tailwind / var                                     |
| ------------------- | ----------- | -------------------------------------------------- |
| Canvas              | `#F0F0F0`   | `bg-background`                                    |
| Foreground / border | `#121212`   | `foreground`, `border`, `--rv-text`, `--rv-border` |
| Red                 | `#D02020`   | `primary`, `bg-rv-primary`                         |
| Blue                | `#1040C0`   | `secondary`                                        |
| Yellow              | `#F0C020`   | `accent`, `accent-foreground` on yellow            |
| Muted surface       | `#E0E0E0`   | `muted`, `bg-rv-surface-muted`                     |

**Dark mode:** Surfaces invert; primaries stay red/blue/yellow; borders/text flip to light on dark—test both `bauhaus-light` and `bauhaus-dark`.

### Typography (spec vs repo)

- **Spec:** Outfit (geometric sans).
- **This repo:** **Space Grotesk** on `--font-heading` / `--font-sans` for Bauhaus blocks. To match spec exactly, switch Bauhaus font vars to Outfit in `globals.css` + layout fonts. Until then, treat **Space Grotesk** as the implemented Bauhaus face (still geometric).

**Scale (marketing):** `text-4xl` → `sm:text-6xl` → `lg:text-8xl` display; labels **uppercase**, **tracking-widest** / **tracking-tighter** on huge type.

---

## Shadows & motion (non-negotiable)

- **Small / control:** `shadow-[4px_4px_0px_0px_var(--rv-border)]` (buttons, small cards).
- **Cards:** `4px_4px` base → hover `4px_8px` + slight **negative translate-Y** (see `BauhausCard`).
- **Press:** `active:translate-x-[2px] active:translate-y-[2px] active:shadow-none` (buttons + card).
- **Duration:** ~**150ms** ease-out hover; **50ms** on active press. Input focus: **steps(1), 80ms** for mechanical snap.

**Avoid:** `shadow-lg` blur, long springy animations, gradient buttons for Bauhaus-branded sections.

---

## Components — patterns & repo alignment

### Buttons (`BauhausButton`)

- Base: `rounded-none`, `border-2 border-rv-text`, hard shadow, uppercase bold tracking.
- **default** → red (`bg-rv-primary`); **secondary** → blue; **outline** → white/surface + black border; **ghost** → no shadow; **link** → blue underline.
- Hover: lift + shadow grow; Active: press + shadow gone.

### Cards (`BauhausCard`)

- `border-4 border-border`, hard shadow, **accent dot** top-right (`accentColor`: red | blue | yellow → maps to `--rv-danger`, `secondary`, `accent`).
- Same lift / press behavior as spec “physical” card.

### Inputs (`BauhausInput`)

- `border-2 border-rv-text`, uppercase bold; focus → **primary border** + **`2px_2px_0px_0px` red shadow** (mechanical).

### Accordions / FAQ (spec)

- Closed: white, `border-4`, `shadow-[4px_4px_0px_0px_black]`.
- Open header: red bg, white text; content: light yellow strip, `border-t-4` black. Chevron **rotate-180**. Implement with tokens (`bg-primary`, `text-primary-foreground`, `bg-accent/20` or `#FFF9C4` if strictly spec).

### Corner decorations

- Small **8px** circle / square / triangle (clip-path) cycling primaries—rotate **45°** on some instances for poster energy.

---

## Layout

- Container **`max-w-7xl`** for poster breadth; section **`py-12` → `lg:py-24`**, **`border-b-4 border-black`** (or `border-foreground`) between major bands.
- **Color blocking:** full-width sections in **solid** primary/secondary/accent—not washed gradients.
- Grids: stats 1→2→4 cols with **divide** borders; asymmetric overlaps allowed for hero compositions.

---

## Icons & imagery

- **Lucide:** stroke **2** (or **3** emphasis); **Circle, Square, Triangle** as brand grammar.
- **Images:** grayscale default → **color on hover** optional; avatars **rounded-full** + grayscale OK.
- Icons in **bordered boxes** with hard shadow where spec demands.

---

## Accessibility

- **Focus:** visible ring or offset outline on buttons/links—**2–3px** consistent with project a11y; use **`focus-visible`**.
- Contrast: black on yellow and white on red/blue must pass **AA** (check large text on yellow).
- Touch targets **≥44px** on mobile.

---

## Responsive

- Mobile-first columns → breakpoints **sm/md/lg** for grids.
- Thicker borders on desktop (`border-2` mobile → `border-4` lg) per spec; shadows can scale up on larger viewports.
- Nav: compact menu &lt;768px if building full marketing shell.

---

## Checklist (new or refactored Bauhaus UI)

1. [ ] Primaries only (+ black/white/muted)—no random accent hues.
2. [ ] Hard offset shadows, not blur elevation.
3. [ ] `rounded-none` or `rounded-full` for Bauhaus chrome—not ambiguous `rounded-lg`.
4. [ ] Button/card **press** and **lift** behaviors preserved or mirrored.
5. [ ] Tokens (`primary`, `secondary`, `accent`, `rv-*`) so **dark** mode stays coherent.
6. [ ] Test **bauhaus-light** and **bauhaus-dark**.

---

## Repo paths

| Area    | Path                                                   |
| ------- | ------------------------------------------------------ |
| Shells  | `components/themes/bauhaus/{Button,Card,Input}.tsx`    |
| Tokens  | `app/globals.css` → `THEME: BAUHAUS`                   |
| Switch  | `components/themes/index.tsx` → `case "bauhaus"`       |
| Texture | `.texture-bauhaus-dots` in globals (optional sections) |

---

## Cross-reference

- **Theme wiring / presets:** `.cursor/agents/skills/theme-instructions.md`
- **Monochrome (different aesthetic):** `.cursor/agents/skills/minimalist-monochrome.md`

---

## Success

Reads as **1920s poster / constructivist** composition: bold blocks, hard geometry, mechanical interaction—not soft SaaS or monochrome editorial.
