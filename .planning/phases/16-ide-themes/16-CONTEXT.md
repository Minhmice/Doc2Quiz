# Phase 16 — IDE-Inspired Themes

## Goal
Signed-in users select and persist an IDE-inspired visual theme from Settings. Selection syncs across devices and avoids a wrong-theme flash on first paint.

## Locked decisions

- Presets: VS Code Dark, VS Code Light, Monokai, High Contrast.
- Keep “Theo hệ thống”; map OS dark to VS Code Dark, OS light to VS Code Light.
- Persist per account through Supabase, synchronized across devices.
- Settings contains Appearance section before Language.
- Theme selector provides named visual swatches and accessible selected state.
- Existing quick dark/light controls remain only if they map predictably to VS Code Dark/Light; otherwise replace with Settings link.

## Implementation boundary

- Keep installed `@teispace/next-themes` for class/system SSR handling. Do not add a package.
- Add validated `theme_preference` column to `profiles`, profile API contract, and server initial preference.
- A small client controller writes `data-theme` to `<html>` and requests account persistence. It must wait for mount and hydrate from server value/local fallback without React mismatch.
- CSS presets override existing semantic shadcn, d2q, sidebar/chart, and quiz/flashcard tokens. Do not refactor all legacy color literals in first pass.
- `data-theme` should select named palette; dark/light class compatibility remains for existing components.

## Theme values

- `system`: OS-selected VS Code Dark/Light.
- `vscode-dark`
- `vscode-light`
- `monokai`
- `high-contrast`

## Scope fences

- No custom color editor/import/export.
- No user-created theme packs.
- No theme-specific component layout changes.
- Do not claim every hardcoded legacy color recolors in v1; visible shell, Settings, core semantic UI, quiz, and flashcard token surfaces must follow selected palette.
