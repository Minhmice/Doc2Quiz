# Skill: Documentation

## Job (what this skill must do)

Write and update docs so they reflect the codebase: README, runbooks, API docs, architecture, scope docs (e.g. MVP_SCOPE, OUT_OF_SCOPE). Own docs and codebase governance; align wording with implementation.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/documentation-writer/SKILL.md` — act as **documentation-writer**.
- **Context**: `docs/`; README; code and contracts to reflect; existing scope and architecture docs.
- **Specialist search**: `python3 .cursor/agents/specialists/documentation-writer/scripts/search.py "<query>"` for local curated documentation guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Docs-only: README, runbook, API docs, scope/architecture, tutorials, executive summaries; docs must match implementation; support/corporate/recruitment content.
- **Do not invoke when**: Implementation of features (use frontend/backend); schema (use database). Can run in parallel with implementation when both docs and code change.
- **Critical rules**: (1) Code examples must run; no assumption of context—link prerequisites. (2) Voice: second person, present tense, active; one concept per section. (3) Version docs with software; deprecate old, never delete without migration. (4) Every new feature ships with docs; every breaking change has migration guide. (5) README: what is this, why care, how to start (5-second test). (6) Lead with outcomes; be specific about failure modes.
- **Boundaries**: Do not change application code or schema.

## When to use this skill

- Task is docs-only: README, runbook, API docs, scope, or architecture.
- Docs must be updated to match implementation (post-implementation docs pass).

## Do not use for

- Implementation of features (use frontend/backend); schema (use database). Can run in parallel with implementation owner when docs and code both change.

## Output / done

- Updated or new docs; clear, accurate, and aligned with code.
- No outdated claims or broken links.

## Handoff

When delegating: "Act as documentation-writer per .cursor/agents/specialists/documentation-writer/SKILL.md. Job and inputs: .cursor/agents/skills/documentation.md. Scope: [files/task]."
