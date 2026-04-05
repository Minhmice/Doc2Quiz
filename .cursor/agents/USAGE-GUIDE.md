# Multi-Agent System + Cursor Rules — Usage Guide (Reusable)

This guide explains how to use the multi-agent system and Cursor rules. The system has two layers: **Cursor rules** apply automatically when you open files matching their globs; **agents** are invoked by your prompt or by the orchestrator.

---

## 1. Overview

| Layer | Location | Purpose |
|-------|----------|--------|
| **Multi-Agent System** | `.cursor/agents/` | Orchestrator and specialists (frontend, backend, planner, code-reviewer, qa-tester, etc.) |
| **Cursor Rules** | `.cursor/rules/` | Persistent rules that apply by file context or always |

Rules auto-apply when you open a file that matches their `globs`. Agents are invoked when you ask for work (or when the orchestrator delegates to them).

---

## 2. Cursor Rules — Frontend & Backend

### 2.1 Frontend Developer (`frontend-developer.mdc`)

**Activates when**: Opening `**/*.tsx`, `**/app/**/*.ts`, `**/components/**/*`

**Project stack (customize per project)**:
- UI framework (Next.js / React / Vue / Svelte)
- Styling (Tailwind / CSS Modules / design system)
- Component library and auth/client SDK if any

**Use for**:
- Pages, layout, components, routing
- Lists/detail views, loading/error/empty states
- Forms, accessibility (a11y)

**Do not use for**:
- API routes, server logic, schema, migration

**Critical rules**:
1. Prefer Server Components; use `"use client"` only when you need hooks or events.
2. Use existing `components/ui/` first; add new ones via `npx shadcn@latest add [name]`.
3. Use Tailwind utility classes; avoid inline styles.
4. Semantic HTML, `aria-*`, keyboard navigation.
5. Always handle loading, error, and empty states; validate API contract.

---

### 2.2 Backend Developer (`backend-developer.mdc`)

**Activates when**: Opening `**/api/**/*.ts`, `**/app/api/**/*`

**Project stack (customize per project)**:
- API runtime (Next.js Route Handlers / Express / Fastify)
- Database and policy model
- Auth provider and validation library

**Use for**:
- API routes (`app/api/`)
- Server actions with DB logic
- Auth, ownership, and permission checks
- Integration and service calls

**Do not use for**:
- Pure UI or styling
- Schema, migration, RLS (→ `database-specialist`)
- Infra/CI only (→ `devops-engineer`)

**Critical rules**:
1. Every protected route must verify identity and return 401 when unauthenticated.
2. Enforce `user_id` / `owner_id` checks before file/folder/share operations.
3. Validate input (e.g. Zod); return 400 with a clear message on invalid payloads.
4. Never expose `access_token`, `refresh_token`, or secrets to the client.

---

### 2.3 Architecture / contracts (no Cursor rule)

For architecture decisions and contract/schema planning, use the **multi-agent layer**:

- Planning/decomposition → `planner`
- API/service architecture → `backend-developer` (design + implementation ownership)
- Contracts/types → `typescript-specialist`
- Schema/RLS/migrations → `database-specialist`
- Multi-domain end-to-end → `orchestrator` (routes to the right specialists)

Cursor rules are kept minimal (frontend/backend) and are mainly for **auto-context** when you open files.

---

## 3. Multi-Agent System

### 3.1 When to use the Orchestrator

- The request is multi-step and touches several domains (FE + BE + DB).
- Scope is unclear and needs to be broken down.
- You want the standard flow: plan → implement → review → QA → docs.

**Example prompts**: *"Analyze and plan implementation for feature X"* or *"Implement feature Y end-to-end"*.

### 3.2 When to use a specialist directly

- Scope is clear: *"Implement UI for explorer"* → frontend-developer.
- *"Add upload dispatch route"* → backend-developer.
- *"Review this code"* → code-reviewer.

### 3.3 Prompt → Agent (quick mapping)

| Prompt contains | Suggested agent |
|-----------------|-----------------|
| `plan`, `decompose`, `roadmap` | planner |
| `UI`, `component`, `page`, `a11y` | frontend-developer |
| `API`, `route`, `auth`, `server` | backend-developer |
| `schema`, `migration`, `RLS` | database-specialist |
| `review`, `security`, `risk` | code-reviewer |
| `test`, `verify`, `edge case` | qa-tester |
| `deploy`, `pipeline`, `rollback` | devops-engineer |
| `docs`, `README`, `runbook` | documentation-writer |
| `gws`, `google workspace`, `cli` | google-cli-specialist |

Details: [`.cursor/agents/routing/rules.yaml`](routing/rules.yaml) and [delegation-matrix.md](routing/delegation-matrix.md).

Search helpers:

- `python3 .cursor/agents/scripts/find_skill.py "<task description>"` suggests the best field and specialist.
- `python3 .cursor/agents/specialists/<specialist-id>/scripts/search.py "<query>"` looks up specialist-local curated guidance.
- `python3 .cursor/agents/scripts/search_curated.py "<query>" --field <field-id>` is only a dispatcher to the local specialist search script.

### 3.4 Chat behavior: the system finds the right agent/skill

**When you start a chat, describe your problem.** The system will classify it and either route you to the right agent/skill or run the orchestrator (plan → implement → review → QA). You do not need to @ the orchestrator; it is always on.

---

## 4. Suggested Workflow

### New feature (e.g. a resource module)

1. **Product / scope** (if unclear): *"Define acceptance criteria for module X"* → product-manager.
2. **Plan**: *"Create implementation plan for module X"* → planner.
3. **Implement**: FE (*"Implement UI for main user flow"* — open `.tsx` so frontend rule applies); BE (*"Implement API for main data flow"* — open API files so backend rule applies).
4. **Review**: *"Review auth and permission changes"* → code-reviewer.
5. **QA**: *"Test edge cases and regression"* → qa-tester.
6. **Docs** (if needed): *"Update README/API docs"* → documentation-writer.

### Bug fix

1. *"Debug stuck or out-of-sync state"* → debugger.
2. *"Review the fix before merge"* → code-reviewer.
3. *"Verify it does not regress"* → qa-tester.

---

## 5. Combining Rules and Agents

- **Rules (automatic)**: Opening a `.tsx` file loads the frontend-developer rule so your prompt has the right context.
- **Agents (by prompt)**: Invoke directly, e.g. *"Act as frontend developer and implement the FileItem component"*.
- **Orchestrator**: A prompt like *"Implement feature X end-to-end"* triggers the orchestrator, which then routes to the right specialists.

---

## 6. Important Folders

```
.cursor/
├── agents/                     # Multi-agent system
│   ├── mappings/               # Canonical rule ownership and skill-finder CSVs
│   ├── registry.yaml           # Agent list
│   ├── orchestrator/           # Orchestrator SKILL and handoff template
│   ├── scripts/                # Shared routing dispatch and validation scripts
│   ├── specialists/            # Specialist SKILLs plus specialist-local data/ and scripts/
│   ├── skills/                 # Job specs by field: one SKILL.md per field (frontend, backend, …); each describes the job and what to use (rule + specialist)
│   ├── routing/                # Routing rules, delegation matrix
│   ├── shared/                 # Contract, templates, checklists
│   └── compat/                 # External skill compatibility
└── rules/                      # Cursor rules
    ├── always-orchestrator-skill.mdc  # Orchestrator always on
    ├── frontend-developer.mdc
    └── backend-developer.mdc
```

Frontend keeps its existing specialist-local UI search system. Other specialists use one `data/catalog.csv` and one local `scripts/search.py`.

---

## 7. Reusing in Another Project

- Update `description` and `globs` in each rule to match the new codebase.
- Update the **Project Stack Context** in frontend/backend rules.
- Keep the same boundaries (FE / BE / DB / DevOps) to avoid overlapping roles.
- External skills: see [`.cursor/agents/compat/external-skill-map.yaml`](compat/external-skill-map.yaml) and [conflict-resolution.md](compat/conflict-resolution.md).
- Use the short template: [`.cursor/agents/RULES-TEMPLATE.md`](RULES-TEMPLATE.md).
