# Skill: Product / Scope

## Job (what this skill must do)

Clarify product scope: requirements, acceptance criteria, priorities, and non-goals. Produce clear, bounded scope so implementation and QA know what "done" means. Do not implement or design architecture.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/product-manager/SKILL.md` — act as **product-manager**.
- **Context**: User request; existing scope docs (e.g. MVP_SCOPE, OUT_OF_SCOPE); constraints and timeline.
- **Specialist search**: `python3 .cursor/agents/specialists/product-manager/scripts/search.py "<query>"` for local curated scope and acceptance guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Requirements or acceptance criteria unclear; scope or priority must be locked before implementation; product/account/deal/feedback strategy; app-store or e-commerce scope.
- **Do not invoke when**: Technical design (use planner); implementation (use frontend/backend).
- **Critical rules**: (1) Produce clear, bounded scope so implementation and QA know what "done" means. (2) Output: acceptance criteria, scope boundaries, non-goals, out-of-scope, priority if relevant. (3) Do not implement or design architecture.
- **Boundaries**: Clarify scope only; hand off to planner for design, specialists for implementation.

## When to use this skill

- Requirements or acceptance criteria are unclear.
- Scope or priority needs to be locked before implementation.

## Do not use for

- Technical design (use planner); implementation (use frontend/backend).

## Output / done

- Clear acceptance criteria and scope boundaries.
- Non-goals and out-of-scope items; priority if relevant.

## Handoff

When delegating: "Act as product-manager per .cursor/agents/specialists/product-manager/SKILL.md. Job and inputs: .cursor/agents/skills/product-manager.md. Request: [summary]."
