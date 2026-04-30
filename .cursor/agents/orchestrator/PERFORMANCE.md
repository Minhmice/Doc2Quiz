# Orchestrator & agent system — performance

Improvements to make agents run faster, use fewer tokens, and avoid unnecessary steps.

---

## 1. Routing: only run scripts when needed

- **Do not run** `find_skill.py` when the domain is obvious from paths:
- `app/api/**`, `lib/**/service` → backend-developer
- `app/**/*.tsx`, `components/**` → frontend-developer
- Both → run both in parallel
- **Run** `find_skill.py` when the task description is vague (e.g. “improve login experience”) or it’s unclear whether it touches FE/BE/DB.
- **Benefit**: saves ~50–100ms and a subprocess for clearly-routable tasks.

---

## 2. Agent count: minimum correct set

- **1 agent**: One file, one module, or one clearly-scoped domain (e.g. fix a README typo, tweak a single component).
- **2 agents (parallel)**: Bugs/features that touch both UI and API; contract work that needs FE+BE; DB migration + backend. Do not serialize if independent.
- **Avoid 3+ agents** for small fixes; only use when multiple domains are truly independent (e.g. research + plan + implement from scratch).

---

## 3. Phase 2 (review + QA): mandatory unless explicitly skipped

- **Default**: After Phase 1 (implement), run **code-reviewer** and **qa-tester** in parallel before considering the task done.
- **Fast path** (only when the user explicitly says so): if the user explicitly says “skip review/QA”, you may run smoke checks instead of full Phase 2.
- **Benefit**: reduces 2 model calls for small tasks while keeping full gates for important work.

---

## 4. Handoff: concise, don’t paste full SKILL

- Each handoff **must start with**:  
  `Act as [specialist] per .cursor/agents/specialists/[specialist]/SKILL.md`
- **Do not** copy the full SKILL content into the prompt; the path reference is enough.
- Include: Objective (1–2 sentences), Scope (paths/modules), Constraints, Expected output.
- **Benefit**: large token savings per handoff, especially for long SKILLs (frontend, backend).

---

## 5. Execution plan: once, fixed format

- Emit **one** short execution plan before delegating (Goal, Code scope, 1–2 agent blocks, Phase 2, Final merge).
- Don’t repeat the same content inside each handoff; handoffs only need per-agent scope + task + output.
- **Benefit**: fewer tokens, less repetition, faster comprehension.

---

## 6. Specialist curated search: only when needed

- Frontend/backend (and other specialists) can run `scripts/search.py` to retrieve curated guidance.
- Only run it when the task needs lookup (e.g. “auth ownership”, “design system”). For straightforward tasks (e.g. “change button text”), skip it.
- **Benefit**: fewer subprocesses and I/O; agents stay focused on implementation.

---

## 7. Quick summary

| Topic       | Do                                                                            | Avoid                                                      |
| ----------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Routing     | Use paths/domain when clear; find_skill when ambiguous                        | Run find_skill for every request                           |
| Agent count | 1 for single-file/domain; 2 parallel when mapping says so                     | 3+ agents for small fixes                                  |
| Phase 2     | Mandatory for normal implementation                                           | Skip gates only when user explicitly says `skip review/QA` |
| Handoff     | SKILL path + objective + scope + output                                       | Paste full SKILL into prompts                              |
| Plan        | One short execution plan before delegating                                    | Repeating the plan inside every handoff                    |
| Search      | Run specialist search when lookup is needed                                   | Run search for every task                                  |
| Fan-out     | Large single-domain work → 2–3 same-specialist instances, merge, then Phase 2 | 3+ different specialists for small fixes                   |
| shadcn      | Shadcn is merged into frontend.md; one frontend handoff covers UI + shadcn    | Attach separate long shadcn docs for every task            |

---

## 8. Fan-out (same-skill parallel)

- **When**: A **large** task within **one domain** (many independent components/files) and the specialist has `max_parallel` in `registry.yaml` (e.g. frontend-developer, backend-developer).
- **Trigger**: Automatically when scope ≥ 4 independent file/component groups, or user says “theme”, “redesign”, “multi-component”, “large scope”.
- **How**: Split scope into 2–3 disjoint slices, spawn 2–3 instances of the same specialist in parallel, merge outputs, then run Phase 2 **once**.
- **Cap**: Max **3** instances (avoid overhead). Only fan-out **one** specialist type per task.
- **Details**: `.cursor/agents/orchestrator/SKILL-DETAILS.md` § Fan-out pattern.

---

**References**: `.cursor/agents/orchestrator/SKILL.md`, `SKILL-DETAILS.md`, `task-to-agent-mapping-rules.md`.
