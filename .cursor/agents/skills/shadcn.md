# Skill: shadcn/ui (reference — merged into frontend.md)

Shadcn guidance is **included in** `.cursor/agents/skills/frontend.md` § Shadcn/ui. Use this file when you need a bit more detail than the frontend skill subsection.

## Project-specific (this repo)

- **Path**: shadcn primitives live under `@/components/theme/shadcn` (not `components/ui`). Aliases in `components.json`: `ui` → `@/components/theme/shadcn`.
- **Theming**: App uses theme wrappers and `useThemeComponents()` from `@/components/themes`. New UI should use theme-aware components; add new primitives under `components/theme/shadcn` and wire via themes if needed.
- **Config**: `components.json` at repo root; style `base-nova`, RSC, Tailwind in `app/globals.css`.

## Patterns (short)

- Use `cn()` for class merging. Extend via wrappers (e.g. in `components/theme/` or `components/workspace/`), not by editing files under `theme/shadcn/` directly when avoidable.
- Add components: `npx shadcn@latest add <name>` then adjust imports to `@/components/theme/shadcn/<name>` if needed.

## Handoff

Delegating frontend work (including shadcn): use `.cursor/agents/skills/frontend.md` only; it already contains the Shadcn/ui subsection. Open this file or `skills/shadcn-ui/SKILL.md` only when you need deeper reference.
