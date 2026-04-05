# Skill: Expo + React Native (Thuocare `.agents` pack)

## Job

Mobile and universal **Expo / React Native** work for this monorepo (`apps/mobile`). Use when the task touches Expo SDK, Expo Router, NativeWind/Tailwind on native, EAS, API routes on Expo, DOM/webview embedding, or client-side data fetching on native — **after** reading the canonical skill file under `.agents/skills/` listed below.

This file is the **Cursor routing layer**: it tells the orchestrator and specialists **which repo skill to open** and which specialist usually owns the work.

## Canonical sources (single source of truth)

All detailed procedures live in **`.agents/skills/`** (project root). Do not duplicate long how-tos here; **read the linked `SKILL.md`** (and `references/` when present).

| ID | Invoke when | Open |
|----|-------------|------|
| `building-native-ui` | Screens, navigation, tabs, headers, animations, Expo Router file structure, native UI patterns | [.agents/skills/building-native-ui/SKILL.md](../../../.agents/skills/building-native-ui/SKILL.md) |
| `expo-tailwind-setup` | Tailwind v4, NativeWind v5, `global.css`, Metro, PostCSS, `className` issues | [.agents/skills/expo-tailwind-setup/SKILL.md](../../../.agents/skills/expo-tailwind-setup/SKILL.md) |
| `upgrading-expo` | Bump Expo SDK, `expo install --fix`, `expo-doctor`, breaking changes | [.agents/skills/upgrading-expo/SKILL.md](../../../.agents/skills/upgrading-expo/SKILL.md) |
| `expo-deployment` | Store submission, EAS Build/Submit, web export, TestFlight/Play | [.agents/skills/expo-deployment/SKILL.md](../../../.agents/skills/expo-deployment/SKILL.md) |
| `expo-dev-client` | Custom dev client, `expo run:*`, internal distribution | [.agents/skills/expo-dev-client/SKILL.md](../../../.agents/skills/expo-dev-client/SKILL.md) |
| `expo-cicd-workflows` | `.eas/workflows`, YAML pipelines | [.agents/skills/expo-cicd-workflows/SKILL.md](../../../.agents/skills/expo-cicd-workflows/SKILL.md) |
| `expo-api-routes` | Server routes in Expo Router + EAS Hosting | [.agents/skills/expo-api-routes/SKILL.md](../../../.agents/skills/expo-api-routes/SKILL.md) |
| `use-dom` | `use dom`, WebView-style universal web in Expo | [.agents/skills/use-dom/SKILL.md](../../../.agents/skills/use-dom/SKILL.md) |
| `native-data-fetching` | Any mobile fetch/query/cache/loader/offline behavior | [.agents/skills/native-data-fetching/SKILL.md](../../../.agents/skills/native-data-fetching/SKILL.md) |

### Machine-readable index

For scripts and search tooling: [data/expo-native-skills-catalog.csv](data/expo-native-skills-catalog.csv).

## Specialist routing (default)

| Area | Primary specialist | Also consider |
|------|-------------------|---------------|
| UI, Router, styling, DOM, data hooks on client | `frontend-developer` | `typescript-specialist` for heavy typing |
| SDK upgrade, dependency alignment | `typescript-specialist` | `frontend-developer` for UI breakages |
| EAS workflows, deploy, dev client binaries | `devops-engineer` | `frontend-developer` for app config |
| Expo Router **server** API routes (backend shape) | `backend-developer` | `devops-engineer` for hosting |

## Project anchors (Thuocare)

- Mobile app: `apps/mobile`
- Expo config: `apps/mobile/app.config.js` (see root [README.md](../../../README.md) for monorepo + `lightningcss` override)
- Router root: `apps/mobile/src/app`
- **SDK module index (sidebar + packages + agent workflow):** [apps/mobile/docs/EXPO_SDK_REFERENCE.md](../../../apps/mobile/docs/EXPO_SDK_REFERENCE.md)

## Handoff

When delegating Expo/React Native work:

1. Name the **specialist** (table above).
2. Attach **this file**: `.cursor/agents/skills/expo-react-native.md`.
3. Attach the **relevant** `.agents/skills/<name>/SKILL.md` (path from table).
4. Scope: `apps/mobile/**` and related `packages/*` only unless the task says otherwise.

Example: *“frontend-developer per `.cursor/agents/specialists/frontend-developer/SKILL.md`. Job: `.cursor/agents/skills/expo-react-native.md` + `.agents/skills/building-native-ui/SKILL.md`. Implement tab screen …”*
