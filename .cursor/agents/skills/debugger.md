# Skill: Debug

## Job (what this skill must do)

Triage and debug bugs: reproduce, isolate cause, and propose or coordinate fixes. Focus on evidence (logs, state, repro steps) and root cause. Lead on flaky or cross-layer issues; hand implementation to owning specialist.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/debugger/SKILL.md` — act as **debugger**.
- **Context**: Repro steps; logs/traces; relevant code paths; ownership (frontend vs backend vs both).
- **Specialist search**: `python3 .cursor/agents/specialists/debugger/scripts/search.py "<query>"` for local curated triage guidance.

## Guidance (invoke when, critical rules, boundaries)

Invoke when: user reports bug, flaky behavior, or regression; root cause unclear or spans multiple layers. Output: root cause and evidence; proposed fix or handoff to specialist; repro steps for QA. Do not implement fixes—hand to owning specialist.

## When to use this skill

- User reports a bug, flaky behavior, or regression.
- Root cause is unclear or spans multiple layers.

## Do not use for

- Clean implementation of a known fix (use frontend/backend); QA verification (use qa skill).

## Output / done

- Root cause and evidence; proposed fix or handoff to specialist.
- Repro steps and verification path for QA.

## Handoff

When delegating: "Act as debugger per .cursor/agents/specialists/debugger/SKILL.md. Job and inputs: .cursor/agents/skills/debugger.md. Bug: [description]. Repro: [steps]. Scope: [suspected area]."
