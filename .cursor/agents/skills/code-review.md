# Skill: Code Review

## Job (what this skill must do)

Review code changes for correctness, security, maintainability, and risk. Act as an independent quality gate; report findings by severity. Do not rewrite implementation; focus on findings and required fixes.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/code-reviewer/SKILL.md` — act as **code-reviewer**.
- **Context**: Diff or changed files; requirements and acceptance criteria; test evidence if provided.
- **Specialist search**: `python3 .cursor/agents/specialists/code-reviewer/scripts/search.py "<query>"` for local curated review heuristics.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: After implementation (Phase 2 gate), in parallel with qa-tester; user explicitly asks for review or risk analysis; compliance or security audit of code.
- **Do not invoke when**: Implementing fixes (hand back to owning specialist); running QA (use qa skill).
- **Critical rules**: (1) Focus: correctness, security, maintainability, performance, testing—not style. (2) Be specific and explain why; suggest, don't demand; prioritize (blocker / suggestion / nit). (3) Blockers: security vulnerabilities, data loss/corruption risks, race conditions, breaking API contracts, missing error handling on critical paths. (4) Suggestions: missing validation, unclear naming, missing tests, N+1/performance, duplication. (5) One review, complete feedback; praise good code. (6) Format: summary first, then findings with severity and concrete fix.
- **Boundaries**: Review only; do not rewrite implementation.

## When to use this skill

- After implementation (Phase 2 gate): code-reviewer in parallel with qa-tester.
- User explicitly asks for review or risk analysis.

## Do not use for

- Implementing fixes (hand back to owning specialist); QA execution (use qa skill).

## Output / done

- Severity-ranked findings (Critical / High / Medium / Low).
- Required fixes and residual risks.
- Short acceptance decision (Accept / Conditional accept / Reject).

## Handoff

When delegating: "Act as code-reviewer per .cursor/agents/specialists/code-reviewer/SKILL.md. Job and inputs: .cursor/agents/skills/code-review.md. Scope: [files/diff]. Review for: correctness, security, maintainability."
