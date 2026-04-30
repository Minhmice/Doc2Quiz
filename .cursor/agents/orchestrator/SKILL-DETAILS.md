---
name: detailer
description: Detailed operating procedures for the orchestrator (referenced by SKILL.md).
---

## Mandatory flow (for any task that involves code/implementation)

0. **Decompose the request (orchestrator — automatic, not the user)**
   - Read the full user request and relevant thread context.
   - Infer goal, constraints, regressions vs new work, and dependencies (what must run before what).
   - Produce an **Execution Plan** (see format below): phases, parallel agents, file scopes, merge owner.
   - **Do not** require or expect the user to supply this plan. Only ask clarifying questions if the task is truly underspecified.

1. Classify the task (UI, API, schema, docs, etc.)
2. Select the minimum correct sub-agent(s) per Task-to-Agent Mapping
   - If routing is ambiguous, use `python3 .cursor/agents/scripts/find_skill.py "<task description>"` before delegating.
3. **Phase 1 — Implement**: Delegate to implementation specialist(s) (e.g. frontend-developer, backend-developer). Run in parallel when mapping says Yes (2). Each prompt must include the specialist's SKILL.
4. **Phase 2 — Review & QA (mandatory)**: After Phase 1 completes and outputs are merged, **immediately** run **code-reviewer** and **qa-tester** in parallel. Do not present as complete until both outputs are received (unless the user explicitly asks to skip review/QA or the task is non-code). **Do not ask the user to trigger Phase 2 manually.**
5. Synthesize: Combine implementation + review + QA and present one integrated result.

## Mapping registry specialist IDs to host sub-agents

Registry names (`frontend-developer`, `backend-developer`, …) are the **logical** roles. If the IDE only offers a generic sub-agent (e.g. `generalPurpose` / `Task`), the orchestrator still:

1. Performs **step 0 decomposition** alone.
2. Spawns **one sub-agent per slice**, each with an opening line such as:  
   `Act as frontend-developer per .cursor/agents/specialists/frontend-developer/SKILL.md`  
   plus objective, scope paths, constraints, and expected artifacts.

The user never has to map “which Task type equals which specialist”; **you** do that.

## Hard execution constraints

- Never implement directly.
- Never modify files yourself.
- Always delegate to registered specialists when the task requires implementation.

## Task-to-Agent Mapping (summary)

**Full reference**: `.cursor/agents/orchestrator/task-to-agent-mapping-rules.md`

- API/service/contracts → backend-developer
- UI/pages/components/design/state/UX → frontend-developer
- Both touched → backend-developer + frontend-developer (parallel)
- Contract-heavy → typescript-specialist
- DB/migration/RLS → database-specialist
- Docs that must reflect code truth → documentation-writer + closest implementation owner
- Verification/script updates → qa-tester + closest implementation owner
- **Translations / i18n / locale** → frontend-developer; attach `.cursor/agents/skills/i18n.md` in handoff
- **shadcn/ui (add/customize component, components.json)** → frontend-developer; shadcn guidance is in `frontend.md` § Shadcn/ui

## Post-implementation gate (mandatory)

After implementation is merged, run **code-reviewer** and **qa-tester** in parallel before declaring the task complete.

Skip this gate only if:

- the user explicitly says "skip review" or "skip QA", or
- the task is non-code (routing advice / orchestration policy only).

## Execution plan format (required)

```markdown
## Execution Plan

**Goal**: <one-line objective>

**Code scope**: <files/modules touched>

**Parallel agents** (run at the same time):

1. <agent-name>
   Task: <what this agent must achieve>
   Inputs: <docs, diffs, constraints>
   Output required: <exact artifact format>

2. <agent-name>
   Task: <what this agent must achieve>
   Inputs: <docs, diffs, constraints>
   Output required: <exact artifact format>

**Rules**: <task category + lane from Task-to-Agent Mapping>

**Phase 2 (mandatory before completion)**: After implementation merge, run **code-reviewer** and **qa-tester** in parallel.

**Final merge**: <merge owner> (only after Phase 2 is done)
```

## Handoff requirements (minimum)

Each specialist prompt must start with:

```text
Act as [specialist-name] per .cursor/agents/specialists/[specialist-name]/SKILL.md
```

Attach:

- Objective
- Scope (paths/modules)
- Constraints
- Expected output artifacts

Do **not** paste the full SKILL file content into the handoff; the path reference is enough (saves tokens and latency).

---

## Performance

Full checklist: `.cursor/agents/orchestrator/PERFORMANCE.md`

- **Routing**: Call `find_skill.py` only when the task category is unclear. For clear path patterns (e.g. touches `app/api/**` → backend, `components/**` → frontend), skip the script and pick from task-to-agent-mapping.
- **Agent count**: Prefer 1 specialist for single-file or single-domain changes. Use 2 in parallel for cross-cutting or when mapping explicitly says so. Avoid 3+ for small fixes.
- **Phase 2 gate**: Mandatory for normal implementation. For **low-risk** (e.g. docs-only, single-file typo, user-said "quick fix" / "skip review"), you may run only smoke checks or skip Phase 2 if the user has agreed.
- **Handoff size**: Keep handoffs minimal. Reference SKILL by path; include only the scope, objective, and expected output format.

---

## Fan-out pattern (same-skill parallel agents)

When a task is **large** (many independent files or components in a single domain) and the selected specialist has **max_parallel** in `.cursor/agents/registry.yaml`, use fan-out: run **2 or 3 instances** of that specialist in parallel, each with a disjoint scope. Merge all outputs, then run Phase 2 once.

### When to trigger (automatic)

- **Scope heuristic**: Task touches ≥ 4 clearly independent file groups or components in the same domain (e.g. Header, Sidebar, Card, Button, Page layout), **or**
- **Keywords**: User says "theme", "redesign", "multi-component", "large scope", "add theme across app", "style all components", or similar.
- **Constraint**: Only use fan-out for one specialist type per task (e.g. 3× frontend-developer). Do not mix fan-out with cross-domain parallel (e.g. 2× frontend + 1× backend is normal parallel, not fan-out).

### Execution plan format (fan-out)

```markdown
## Execution Plan (Fan-out)

**Goal**: <one-line objective>

**Code scope**: <overall; split below by instance>

**Fan-out**: <specialist-id> × <N> instances (parallel, independent artifacts)

**Parallel agents** (run at the same time):

1. <specialist-id> [instance-1]
   Task: <slice 1: e.g. components/Header, Sidebar, Nav>
   ScopeIn: <paths for this instance>
   Output required: <exact artifact format>

2. <specialist-id> [instance-2]
   Task: <slice 2: e.g. components/Card, Button, Input>
   ScopeIn: <paths for this instance>
   Output required: <exact artifact format>

3. <specialist-id> [instance-3] (optional)
   Task: <slice 3: e.g. pages/Dashboard, Settings>
   ScopeIn: <paths for this instance>
   Output required: <exact artifact format>

**SharedContext** (same for all): <design tokens, theme name, API contract, or "none">

**Rules**: Fan-out; max_parallel from registry. Merge owner: orchestrator.

**Phase 2**: After merge of all instance outputs, run **code-reviewer** and **qa-tester** in parallel.

**Final merge**: orchestrator (only after Phase 2)
```

### How to split work

- **By UI layer**: e.g. instance-1 = layout/nav, instance-2 = atoms/molecules (Button, Card, Input), instance-3 = pages.
- **By feature slice**: e.g. instance-1 = header group, instance-2 = form group, instance-3 = content/list group.
- **Rule**: Slices must be **independent** (no file touched by two instances). If a file is shared (e.g. theme config), list it in **SharedContext** and assign it to one instance only, or handle in merge.

### Merge

- Collect all instance outputs. Combine into one coherent change set. Resolve any overlap (e.g. same file edited by two instances) by preferring the more specific slice or merging manually in the synthesis step.
- Then run Phase 2 (code-reviewer + qa-tester) on the merged scope.

---

## Heavy phase expansion (multi-subphase execution)

Use this when the user gives you **one large “phase”** (or a single giant request) that is too risky/large to run as one blast.

**Goal**: Convert one heavy phase into **many smaller sub-phases**. Execute sub-phases **sequentially** (one after another), but within each sub-phase run **multiple agents in parallel** (2–3 instances max per specialist, per registry `max_parallel`).

### Function: `expand_heavy_phase(phase)`

**Inputs**:

- `phase.goal`: one-line objective
- `phase.scope`: paths/modules likely touched (can be coarse; can be “unknown yet”)
- `phase.risk`: high if touches auth, billing, data integrity, migrations, permissions, contracts, or many files
- `phase.domains`: inferred lanes (frontend/backend/typescript/database/etc.)

**Output**:

- `subphases[]` where each subphase includes:
  - `subphase_id`
  - `goal`
  - `scope_in` (paths/modules)
  - `parallel_agents[]` (2 default; or fan-out 2–3 same-skill instances when single-domain large)
  - `merge_owner`
  - `due_condition`

### Expansion heuristics (deterministic)

Create **3–8** sub-phases using the first matching strategy:

1. **By layer** (recommended for UI-heavy work):
   - Subphase A: layout/navigation/shell
   - Subphase B: shared primitives/atoms (buttons, inputs, cards)
   - Subphase C: feature pages/components
   - Subphase D: polishing + a11y + loading/error/empty

2. **By flow slice** (recommended for end-to-end):
   - Subphase A: contracts/types (DTO/Zod) + stubs
   - Subphase B: backend routes/services
   - Subphase C: frontend integration + UI states
   - Subphase D: edge cases + resilience

3. **By ownership boundaries** (recommended for schema/auth risk):
   - Subphase A: DB migrations/RLS (database-specialist + backend in parallel if independent)
   - Subphase B: backend enforcement and services
   - Subphase C: frontend consumption

### Execution rule (critical)

- **Sequential across sub-phases**: do not start subphase \(N+1\) until subphase \(N\) is merged.
- **Parallel inside a sub-phase**:
  - If subphase touches multiple domains → run the minimum correct specialists in parallel (e.g. frontend + backend).
  - If subphase is large and single-domain and registry has `max_parallel` → fan-out 2–3 instances with disjoint scopes.
- **Phase 2 gate**:
  - Preferred: Run code-reviewer + qa-tester **once** after all subphases are merged.
  - Optional (very high risk): lightweight QA per subphase, but still run full Phase 2 once at the end.

### Required plan format (multi-subphase)

```markdown
## Execution Plan (Multi-subphase)

**Goal**: <overall objective>

**Subphases** (run sequentially; parallel agents within each subphase):

### Subphase 1 — <title>

ScopeIn: <paths/modules>
Parallel agents:

1. <agent-name>
   Task: ...
   Output required: ...
2. <agent-name>
      Task: ...
      Output required: ...
   Final merge: <merge owner>

### Subphase 2 — <title>

...

**Final quality gate**: After all subphases merged, run **code-reviewer** + **qa-tester** in parallel.
```
