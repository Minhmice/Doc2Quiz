# Skill: Stitch (Google Stitch MCP) — **on-demand only**

## Critical

**Load and use this file only when the user explicitly asks for Stitch**, e.g. “use Stitch”, “generate with Stitch”, “Stitch MCP”, “baton prompt for Stitch”, HTML from Stitch. Do **not** attach this skill for normal frontend work.

## Job

Drive Stitch iterations for RawVault UI: consistent design system in every baton, site map, and per-page generation prompts. Output is Stitch-oriented HTML/mock flow; integrate into React with `useThemeComponents()` per project conventions.

## RawVault Auth — design system (paste into every Stitch baton)

**DESIGN SYSTEM (REQUIRED):**

- Platform: Web, Desktop-first
- Theme: Light/Dark adaptive, photography-first, minimal
- Background: Soft slate (#f8fafc) light / near-black (#030712) dark
- Surface: White (#ffffff) light / dark gray (#111827) dark for cards
- Primary Accent: Blue (#3b82f6) for buttons and links
- Text Primary: Slate (#0f172a) light / near-white (#f9fafb) dark
- Text Secondary: Muted gray (#64748b / #9ca3af)
- Font: Outfit for headings (uppercase, tracking), Inter for body
- Buttons: Rounded corners (9px), uppercase, comfortable padding
- Cards: Rounded (12px), border, subtle shadow
- Layout: Centered, max-width 28rem, generous whitespace
- No harsh shadows, no aggressive colors — serene and trustworthy

## Site vision (Stitch)

- **Project:** RawVault Auth — Sign In / Sign Up for drive-lite RAW photographers
- **Voice:** Professional, minimal, trustworthy
- **Integration:** Stitch HTML → React with `useThemeComponents()`; align with RawVault themes (vivid, monochrome, bauhaus, linear)
- **Sitemap:** `login`, `signup`
- **Roadmap:** Generate login → signup → convert to React components

## Example page baton — login

**Page:** Sign In — drive-lite for RAW photographers.

Use the DESIGN SYSTEM block above. **Structure:**

1. Centered card (max-w-md), RawVault logo/title
2. Form: email, password
3. Primary CTA: Sign In
4. Secondary: “Don’t have an account? Sign up”
5. Error area (subtle red)
6. Loading: disabled button + “Signing in…”

## Local folder (optional)

Workflows that download Stitch HTML/screenshots may recreate `.stitch/designs/` in the repo root. Source of truth for **prompts and tokens** is this file unless you regenerate a project-local `DESIGN.md`.

## Handoff

When user invoked Stitch: “Stitch baton per `.cursor/agents/skills/stitch.md`; task: [page/feature].”
