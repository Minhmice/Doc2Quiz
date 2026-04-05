# Skills — One skill per field

This folder holds **one skill file per field**. Each file is the single source of guidance for that field: job, specialist, context, and when/how to use it. The orchestrator and handoffs reference these files to assign work.

The detailed searchable knowledge now lives in:

- `.cursor/agents/specialists/<specialist-id>/data/catalog.csv` for specialist-local curated guidance
- `.cursor/agents/specialists/<specialist-id>/scripts/search.py` for specialist-local curated lookup
- `.cursor/agents/mappings/rule-map.csv` for canonical rule ownership
- `.cursor/agents/mappings/skill-finder.csv` for task-to-field routing hints
- `.cursor/agents/scripts/find_skill.py` for field/specialist suggestions
- **Expo / React Native (repo):** `.agents/skills/**` — indexed from Cursor via [expo-react-native.md](expo-react-native.md) and [data/expo-native-skills-catalog.csv](data/expo-native-skills-catalog.csv)

## How it works

- **Skill** = job description + specialist + guidance (invoke when, critical rules, boundaries).
- **Specialist** (`.cursor/agents/specialists/<id>/SKILL.md`) = the agent that executes the job; the skill file points to this specialist.

When you assign a task to a field, use the skill file below so the executor knows the job and what to use. Each skill file includes a **Guidance** section with invoke when, critical rules, and boundaries.

## Index: field → skill file → specialist

| Field | Skill file | Specialist (agent) |
|-------|------------|---------------------|
| Frontend | [frontend.md](frontend.md) | `frontend-developer` |
| Backend | [backend.md](backend.md) | `backend-developer` |
| TypeScript / contracts | [typescript.md](typescript.md) | `typescript-specialist` |
| Database / schema / RLS | [database.md](database.md) | `database-specialist` |
| DevOps / deploy / CI | [devops.md](devops.md) | `devops-engineer` |
| Documentation | [documentation.md](documentation.md) | `documentation-writer` |
| QA / testing | [qa.md](qa.md) | `qa-tester` |
| Code review | [code-review.md](code-review.md) | `code-reviewer` |
| Planning | [planner.md](planner.md) | `planner` |
| Product / scope | [product-manager.md](product-manager.md) | `product-manager` |
| Research | [research.md](research.md) | `research-analyst` |
| Debug | [debugger.md](debugger.md) | `debugger` |
| Google CLI (gws) | [google-cli.md](google-cli.md) | `google-cli-specialist` |
| i18n | [i18n.md](i18n.md) | `frontend-developer` |
| shadcn/ui | In [frontend.md](frontend.md) § Shadcn/ui; optional [shadcn.md](shadcn.md) | `frontend-developer` |
| Responsive | [frontend.md](frontend.md) § Responsive design; search `-d responsive` | `frontend-developer` |
| Stitch MCP | [stitch.md](stitch.md) — **only when user asks for Stitch** | `frontend-developer` |
| Minimalist Monochrome | [minimalist-monochrome.md](minimalist-monochrome.md) | `frontend-developer` |
| Theme system (presets, tokens, wiring) | [theme-instructions.md](theme-instructions.md) | `frontend-developer` |
| Bauhaus (constructivist) | [bauhaus-theme.md](bauhaus-theme.md) | `frontend-developer` |
| Linear / modern dark (cinematic) | [linear-modern-dark.md](linear-modern-dark.md) | `frontend-developer` |
| **Orchestrator** | — | See `.cursor/agents/orchestrator/SKILL.md` |
| **Expo + React Native** (Thuocare `.agents` pack) | [expo-react-native.md](expo-react-native.md) | Usually `frontend-developer`; `devops-engineer` / `typescript-specialist` / `backend-developer` per task (see that file) |

## Using a skill in a handoff

Reference the skill file so the agent knows the job and assignment, for example:

- "Do the **frontend** job per `.cursor/agents/skills/frontend.md`. Task: …"
- "Act as backend-developer per `.cursor/agents/specialists/backend-developer/SKILL.md`. Use the job and inputs from `.cursor/agents/skills/backend.md`. Scope: …"

The specialist SKILL is what the agent runs as; the skill file here is the **job spec** (what to do, what to use).

## Search Workflow

- Prefer specialist-local curated search first: `python3 .cursor/agents/specialists/<specialist-id>/scripts/search.py "<query>"`
- If routing is unclear: `python3 .cursor/agents/scripts/find_skill.py "<task description>"`
- Use raw skill/rule search only as fallback with `--fallback-raw`
- Frontend is the intentional exception and keeps its richer multi-CSV UI system
