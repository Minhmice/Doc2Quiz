# Skill: Minimalist Monochrome (Editorial Design System)

## When to use this skill

- User asks for **Minimalist Monochrome**, **editorial B&W**, **Vogue-style**, **no accent color**, or **sharp / zero radius** UI.
- Task touches **`components/themes/monochrome/**`**, **MonochromeCard / MonochromeButton / MonochromeInput\*\*, or workspace UI that must stay consistent with the monochrome preset.
- Refactoring **any component** to respect this design language inside RawVault.

**Handoff line for orchestrator / frontend-developer:**  
_Act as frontend-developer per `.cursor/agents/specialists/frontend-developer/SKILL.md`. Apply `.cursor/agents/skills/minimalist-monochrome.md` for all styling and interaction rules. Scope: [files]._

---

## Role (agent mindset)

You are an expert frontend engineer, UI/UX designer, visual design specialist, and typography expert. **Before code:**

1. **Stack (this repo):** Next.js App Router, React 19, Tailwind v4 (`app/globals.css` `@theme`), shadcn-style primitives under `@/components/theme/shadcn`, **named themes** via `next-themes` + `data-theme="monochrome-light"` / `monochrome-dark`, hybrid knobs (`primaryColor`, `borderRadius`) from `useTheme()`.
2. **Tokens:** Prefer **semantic Tailwind** — `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-muted`. Monochrome **light** maps to pure B&W editorial; **dark** inverts surfaces — still no rainbow accents.
3. **Architecture:** Theme-specific shells live in `components/themes/monochrome/`. Shared pages often use `useThemeComponents()` → Monochrome\* when `themeName === "monochrome"`.
4. **Constraints:** Do not introduce blue gradients, soft lg radii, or shadow elevation for this aesthetic. Gray only for **secondary** copy and subtle dividers, not as a substitute for black/white drama.

Ask focused questions if scope is unclear: single component vs full page vs token-only tweak.

---

## Design philosophy (non-negotiables)

| Principle                  | Implementation hint                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Reduction to essence**   | Black, white, controlled gray for secondary only. No accent colors “for interest.”                                                  |
| **Serif as hero**          | Headings: Playfair (already `--font-heading` in monochrome blocks). Body: Source Serif. Labels: JetBrains Mono, uppercase tracking. |
| **Sharp geometry**         | **0px radius** in monochrome preset (`borderRadius` preset 0). Classes: `rounded-none`.                                             |
| **Lines, not blobs**       | Borders, underlines, rules — not shadows or glows.                                                                                  |
| **Inversion for emphasis** | Hover/selected: black surface + white type (see MonochromeCard patterns).                                                           |
| **Motion: binary / fast**  | `duration-100` or `steps(1)` — no bouncy easing for core chrome.                                                                    |

**NOT this style:** colorful, rounded-xl friendly SaaS, gradients, shadow cards, blue primary as decoration.

---

## Token mapping (RawVault)

CSS lives in `app/globals.css` under `:root[data-theme="monochrome-light"]` and `:root[data-theme="monochrome-dark"]`. Conceptual targets:

| Semantic                | Light (editorial)                            | Notes                        |
| ----------------------- | -------------------------------------------- | ---------------------------- |
| background / foreground | white / black                                | Stark contrast               |
| card                    | white                                        | Border black                 |
| muted                   | off-white field                              | `#f5f5f5` band               |
| muted-foreground        | dark gray                                    | Secondary copy only          |
| border                  | black                                        | Hairline to 2px for emphasis |
| primary                 | black (user may override via `--rv-primary`) | “Accent” is black            |

**In components:** never hardcode `#000` / `#fff` if the same intent exists as `bg-foreground` + `text-background` on hover — use tokens so **dark monochrome** stays coherent.

---

## Typography

- **Display / H1–H3:** `font-heading`, tight tracking, uppercase acceptable for nav/labels.
- **Body:** `font-sans` (Source Serif in theme).
- **Meta / dates / filters:** `font-mono`, `text-xs`, `uppercase`, `tracking-widest`.
- **Dramatic marketing pages:** scale up (`text-5xl` → `text-8xl` desktop); stack down on mobile — drama must survive mobile.

---

## Components — patterns

### Buttons (MonochromeButton)

- Primary: black fill, white text; hover invert (or instant flip).
- Outline: 2px border black, hover fill black.
- Ghost: underline on hover, no pill shape.
- **Focus:** `focus-visible:outline` 3px `foreground`, offset 3px (WCAG).

### Cards (MonochromeCard + lists)

- Default: `bg-card`, `border-border` (2px in shell), **no shadow**.
- Hover / selected: `bg-foreground` + `text-background`; **all** child text/icons must flip (use card-level selectors or `data-mono-*` hooks — see `FileGrid` + `MonochromeCard`).
- **Preview panes:** avoid a white island on black hover — use `group-hover:bg-transparent` on inner panels so content stays visible.

### Inputs (MonochromeInput)

- Bottom or full black border, 2px → 3–4px on focus; `rounded-none`.
- Placeholder: muted, optional italic.

### Textures (marketing / section backgrounds)

Use utilities in `globals.css`: `.texture-horizontal-lines`, `.texture-grid`, `.texture-bauhaus-dots` is **Bauhaus** — for monochrome prefer horizontal lines / subtle noise. Opacity **very low** (0.01–0.04) so type stays readable.

### Icons (Lucide)

- Stroke 1–1.5, `text-foreground` or inherit; on inverted surfaces force `text-background`.

---

## Layout

- Containers: `max-w-6xl` or project max; generous `px-6 md:px-12`, vertical `py-24+` between major sections.
- **Section breaks:** thick horizontal rule (`border-t-4 border-foreground`) between major blocks on landing-style pages.

---

## Accessibility

- Contrast: B/W is AAA for body text.
- **Every** interactive element: visible `focus-visible` (outline or border thicken).
- Touch targets ≥ 44px on mobile.
- Skip link: black bar, white text, first focusable.

---

## Implementation checklist (new or refactored component)

1. [ ] Uses `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground` — no random hex except swatches/data viz forbidden in this theme.
2. [ ] `rounded-none` (or theme-driven radius 0 for monochrome).
3. [ ] No `shadow-lg` / glow for chrome; depth = border + inversion + space.
4. [ ] Hover/focus states are **instant or ≤100ms** for editorial chrome.
5. [ ] If card inverts on hover, **every** child (icons, badges, preview) must remain visible (test light-on-light).
6. [ ] Fonts: heading/body/mono roles respected.
7. [ ] Run through **monochrome-light** and **monochrome-dark** `data-theme` values.

---

## Repo pointers

| Area               | Path                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| Theme shell        | `components/themes/monochrome/{Card,Button,Input}.tsx`                 |
| Tokens             | `app/globals.css` → `monochrome-light` / `monochrome-dark`             |
| Example complex UI | `components/workspace/FileGrid.tsx` (mono hover, preview pane, badges) |
| Theme switch       | `components/theme-provider/ThemeProvider.tsx`, `ThemePanel`            |

---

## Differentiation vs “Minimalist Modern” (Vivid)

|        | Vivid / modern  | Minimalist Monochrome |
| ------ | --------------- | --------------------- |
| Color  | Blue, gradients | Black / white only    |
| Type   | Sans            | Serif display + body  |
| Radius | lg/xl           | 0                     |
| Depth  | Shadow, lift    | Flat, borders, invert |

---

## Success criteria

Feels like: fashion editorial, gallery catalog, luxury print.  
Does **not** feel like: generic SaaS, “we removed color from Vivid,” or playful UI.
