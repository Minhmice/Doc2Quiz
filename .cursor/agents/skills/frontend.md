# Skill: Frontend

## Job (what this skill must do)

Implement and fix UI: pages, layouts, components, routing, client state, and accessibility. Deliver correct, accessible, maintainable UI with clear loading, error, and empty states. Use the project design system and API contracts; do not implement API routes or server-only logic.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/frontend-developer/SKILL.md` — act as **frontend-developer**; use scripts/design system if UI/UX work.
- **Context**: API contracts (response shapes, error codes); design tokens and `components/theme/shadcn` (this project); app router and layout.
- **Specialist search**: `python3 .cursor/agents/specialists/frontend-developer/scripts/search.py "<query>"` for the existing frontend UI and design-system search workflow.

## Theme system (all presets)

- **When**: New preset, `data-theme` / globals.css blocks, `useThemeComponents`, ThemeProvider, or “theme looks wrong after switch.”
- **Skill**: `.cursor/agents/skills/theme-instructions.md` — architecture, preset matrix (vivid / monochrome / bauhaus / linear), checklists. Rule: `.cursor/rules/theme-instructions.mdc` (theme-provider + `themes/index.tsx`).

## Bauhaus (constructivist preset)

- **When**: Bauhaus visuals, hard shadows, R/Y/B blocks, geometric marketing, or edits `components/themes/bauhaus/**`.
- **Skill**: `.cursor/agents/skills/bauhaus-theme.md`. Rule: `.cursor/rules/bauhaus-theme.mdc`.

## Linear / modern dark (cinematic preset)

- **When**: Linear-style dark, ambient blobs, indigo accent, spotlight cards, bento, or edits `components/themes/linear/**`.
- **Skill**: `.cursor/agents/skills/linear-modern-dark.md`. Rule: `.cursor/rules/linear-modern-dark.mdc`.

## Minimalist Monochrome (editorial B&W theme)

- **When**: User wants monochrome editorial UI, zero-radius sharp chrome, inversion hover, or edits `components/themes/monochrome/**`.
- **Skill**: `.cursor/agents/skills/minimalist-monochrome.md` — full tokens, checklists, RawVault paths. Rule: `.cursor/rules/minimalist-monochrome.mdc` (globs monochrome theme files).
- **Handoff**: Attach `minimalist-monochrome.md` alongside this file for any monochrome-themed component or page.

## Shadcn/ui (this project — apply when working with components/theme/shadcn or components.json)

- **Path**: Primitives live under `@/components/theme/shadcn`. `components.json` → `ui`: `@/components/theme/shadcn`. Style `base-nova`, RSC, Tailwind in `app/globals.css`.
- **Theming**: Use theme wrappers and `useThemeComponents()` from `@/components/themes`. New UI uses theme-aware components; add new primitives under `components/theme/shadcn` and wire via themes if needed.
- **Add component**: `npx shadcn@latest add <name>`; then fix imports to `@/components/theme/shadcn/<name>` if needed. Use `cn()` for class merging; extend via wrappers in `components/theme/` or `components/workspace/`, not by editing `theme/shadcn/` directly when avoidable.
- **More detail**: `.cursor/agents/skills/shadcn.md`; optional project reference `.cursor/agents/compat/skills/shadcn-ui/SKILL.md` if present.

## Responsive design (merged from responsive-design skill)

- **When**: Adaptive layouts, breakpoints, container queries, fluid type/spacing, responsive grid/nav/tables/images, viewport units (dvh), touch targets.
- **Search**: `python3 .cursor/agents/specialists/frontend-developer/scripts/search.py "<query>" -d responsive` (BM25 over `data/responsive-design.csv`). For stack-specific UI, still use `-s nextjs` / `web` / `ux` as needed.
- **Practices**: Mobile-first (`min-width`); content-driven breakpoints; `clamp()` for fluid type/spacing; container queries (`container-type: inline-size`, `@container`) for reusable components; Grid `auto-fit` + `minmax`; prefer `dvh` over raw `100vh` on mobile; 44px min touch targets; `srcset`/`sizes` or `<picture>` for images; tables → scroll or card layout on small screens.

## Stitch (Google Stitch MCP) — **opt-in only**

- **Do not** open or follow Stitch docs unless the user **explicitly** asks for Stitch / Stitch MCP / baton HTML generation.
- When they do: `.cursor/agents/skills/stitch.md` (design system baton, site vision, page prompts).

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Pages, layouts, components, routing (`app/`, `components/`); user-facing flows; loading/error/empty states; forms; accessibility (a11y); design system or UI consistency; prototypes; mobile/XR/visual interfaces when task is UI.
- **Do not invoke when**: API routes (`app/api/`), server actions with DB logic, schema/migrations/infra.
- **Critical rules**: (1) Prefer Server Components; add `"use client"` only for hooks, events, or browser APIs. (2) Use existing UI primitives first; add new components consistently. (3) Follow project tokens and spacing; avoid ad-hoc style drift. (4) Accessibility: semantic HTML, `aria-*`, keyboard nav, loading/error announcements; WCAG 2.2 AA minimum; test with keyboard and screen reader—automated tools catch ~30%, manual testing catches the rest. (5) API contracts: validate response shapes; handle loading, error, empty; never assume success. (6) Design system: design tokens, 4.5:1 contrast, 44px min touch targets; respect `prefers-reduced-motion`. (7) Run `npm run lint` before handoff.
- **Boundaries**: Do not change API route signatures or backend logic; do not modify deployment/infra. Hand off to backend for API/schema changes.

## When to use this skill

- Task touches views, components, routing, or client state.
- UI behavior, accessibility, or visual consistency is required.
- Acceptance criteria include frontend deliverables.

## Do not use for

- API routes, server actions with DB logic, schema, migrations, infra.

## Output / done

- Frontend code changes (components, pages, hooks).
- Loading/error/empty handling; a11y considerations.
- Notes on contract alignment and manual test steps.

## Handoff

When delegating: "Act as frontend-developer per .cursor/agents/specialists/frontend-developer/SKILL.md. Job and inputs: .cursor/agents/skills/frontend.md. Scope: [files/task]."
