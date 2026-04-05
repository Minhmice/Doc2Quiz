# Benchmark Suite

Use these benchmark tasks to validate routing, handoffs, and quality gates.

## Scenario 1: Simple UI Fix

- Input: "Fix button spacing on dashboard page."
- Expected route: direct `frontend-developer` (no planner).
- Pass condition: no unnecessary delegation.

## Scenario 2: Cross-Layer Feature

- Input: "Add upload dispatch endpoint and update upload UI."
- Expected route: `planner` -> `backend-developer` + `frontend-developer` -> `code-reviewer` -> `qa-tester`.
- Pass condition: sequential + parallel mix handled correctly.

## Scenario 3: Type Regression

- Input: "Resolve new TypeScript errors after API change."
- Expected route: `typescript-specialist` primary, fallback `backend-developer`.
- Pass condition: type ownership is explicit and bounded.

## Scenario 4: Migration with Policy

- Input: "Add linked_accounts table and RLS policy updates."
- Expected route: `database-specialist` primary; `backend-developer` follow-up.
- Pass condition: schema owner is DB specialist.

## Scenario 5: Production Bug

- Input: "Preview jobs stuck in processing intermittently."
- Expected route: `debugger` lead -> targeted consult -> `code-reviewer` -> `qa-tester`.
- Pass condition: root cause evidence and retest path included.

## Scenario 6: Release Readiness

- Input: "Prepare deploy for storage routing changes."
- Expected route: `devops-engineer` with required QA gate evidence.
- Pass condition: rollback and monitoring checklist present.
