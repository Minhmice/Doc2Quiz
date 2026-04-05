# Skill: Planning

## Job (what this skill must do)

Produce implementation plans: phased steps, dependencies, acceptance criteria, and risk. Turn goals into an actionable execution plan with clear sequencing and decision points. Do not implement; only plan.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/planner/SKILL.md` — act as **planner**.
- **Context**: Problem statement; architecture and current code; non-goals and risk tolerance; handoff template for downstream agents.
- **Specialist search**: `python3 .cursor/agents/specialists/planner/scripts/search.py "<query>"` for local curated planning heuristics.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Scope spans multiple files/layers; migration/refactor risk; dependencies and ordering unclear; user wants a plan before implementation; architecture, workflows, sprint/backlog, or project sequencing.
- **Do not invoke when**: Single-step, low-risk fix with obvious implementation (go straight to specialist).
- **Critical rules**: (1) No architecture astronautics—every abstraction must justify complexity. (2) Trade-offs over best practices; name what you give up. (3) Domain first, technology second. (4) Reversibility: prefer decisions easy to change. (5) Document decisions (ADRs: context, options, rationale). (6) Output: phased plan, dependencies, acceptance criteria per phase, risk list, recommended delegation sequence.
- **Boundaries**: Plan only; do not implement. Hand off to implementation specialists.

## When to use this skill

- Scope spans multiple files or layers; migration/refactor risk is non-trivial.
- Dependencies and ordering are unclear; user wants a plan before implementation.

## Do not use for

- Single-step, low-risk fixes with obvious implementation (go straight to specialist).

## Output / done

- Phased plan with dependencies and acceptance criteria per phase.
- Risk list with mitigations; recommended delegation sequence (which agents, in what order).

## Handoff

When delegating: "Act as planner per .cursor/agents/specialists/planner/SKILL.md. Job and inputs: .cursor/agents/skills/planner.md. Goal: [one line]. Constraints: [non-goals, risk]."
