# Skill: QA / Testing

## Job (what this skill must do)

Verify changes: test plans, pass/fail criteria, edge cases, and regression. Produce QA evidence (manual or automated) and a clear pass/fail decision. Do not implement features; only verify.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/qa-tester/SKILL.md` — act as **qa-tester**.
- **Context**: Changed files or scope summary; acceptance criteria; test scripts and runbooks in the repo.
- **Specialist search**: `python3 .cursor/agents/specialists/qa-tester/scripts/search.py "<query>"` for local curated QA heuristics.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: After implementation (Phase 2 gate), in parallel with code-reviewer; user asks for verification, test plan, or regression check; API validation, performance testing, or test-result analysis.
- **Do not invoke when**: Implementing code (use frontend/backend); reviewing code (use code-review).
- **Critical rules**: (1) Every API: functional, performance, and security validation; test auth/authz, input validation, error handling. (2) Performance: response time targets (e.g. 95th pct <200ms), load testing; avoid N+1. (3) Security: OWASP API Top 10; no SQL injection; rate limiting tested. (4) Test results: analyze patterns, failure trends, release readiness; data-driven recommendations with evidence. (5) Deliver: test plan or steps; pass/fail per criterion; regression risks; evidence (test output, manual steps).
- **Boundaries**: Verify only; do not implement fixes. Hand back to owning specialist for fixes.

## When to use this skill

- After implementation is complete (Phase 2 gate): QA in parallel with code-reviewer.
- User asks for verification, test plan, or regression check.

## Do not use for

- Implementing code (use frontend/backend); reviewing code (use code-review skill).

## Output / done

- Test plan or steps; pass/fail per criterion; regression risks.
- Evidence (e.g. test output, manual steps) and next action.

## Handoff

When delegating: "Act as qa-tester per .cursor/agents/specialists/qa-tester/SKILL.md. Job and inputs: .cursor/agents/skills/qa.md. Scope: [files/task]. Acceptance criteria: [list]."
