# Skill: Backend

## Job (what this skill must do)

Implement and fix API routes, server logic, auth checks, ownership validation, and service integration. Build reliable backend behavior with clear contracts, safety checks, and maintainable logic. Validate all inputs; never expose secrets to the client.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/backend-developer/SKILL.md` — act as **backend-developer**.
- **Context**: `lib/contracts/` for request/response schemas; auth (e.g. `requireAuthenticatedUser`); service layer in `lib/`; route handlers in `app/api/`.
- **Specialist search**: `python3 .cursor/agents/specialists/backend-developer/scripts/search.py "<query>"` for local curated backend guidance; add `--fallback-raw` only when curated results are insufficient.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: API routes (`app/api/`, Route Handlers); server actions with DB logic; auth checks, permissions, ownership validation; service orchestration and provider/integration calls; security review of backend code; threat modeling or vulnerability assessment for app/API.
- **Do not invoke when**: Pure UI/styling; schema design, migrations, RLS (handoff database-specialist); infra/CI only (handoff devops-engineer).
- **Critical rules**: (1) Auth first: every protected route must verify identity and return 401 when unauthenticated. (2) Ownership: enforce resource ownership (`user_id`/`owner_id`) before read/write. (3) Validation: validate all inputs (e.g. Zod); return explicit 400 for invalid payloads. (4) No secret exposure: never expose tokens or secrets in client responses. (5) Security: assume user input is malicious—validate/sanitize at trust boundaries; prefer parameterized queries; no hardcoded credentials; default deny / whitelist over blacklist. (6) Avoid N+1; use precise `.select()`; return consistent JSON shapes.
- **Boundaries**: Do not change schema/migrations (handoff database-specialist); do not bypass permission checks.

## When to use this skill

- Task involves API routes, server actions, auth, or service orchestration.
- Business logic, validation, or integration behavior changes.

## Do not use for

- UI-only work; schema/migrations/RLS (use database skill); infra/CI only (use devops skill).

## Output / done

- Backend implementation (routes, services, validation).
- API contract notes and verification evidence.
- No secret or token in responses.

## Handoff

When delegating: "Act as backend-developer per .cursor/agents/specialists/backend-developer/SKILL.md. Job and inputs: .cursor/agents/skills/backend.md. Scope: [files/task]."
