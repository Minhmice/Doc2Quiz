# Skill: TypeScript / Contracts

## Job (what this skill must do)

Own types, Zod schemas, and API contracts. Fix type errors, align DTOs with routes and clients, and keep shared contracts canonical. Ensure type-safe request/response handling and no shadow DTOs.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/typescript-specialist/SKILL.md` — act as **typescript-specialist**.
- **Context**: `lib/contracts/` (Zod schemas, exports); route handlers and client call sites; shared types and generics.
- **Specialist search**: `python3 .cursor/agents/specialists/typescript-specialist/scripts/search.py "<query>"` for local curated contract and typing guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Type errors, generics, Zod/contracts, contract drift; DTOs and request/response shapes; contract-heavy change affecting frontend and backend.
- **Do not invoke when**: UI-only styling; backend-only logic with no contract change; schema/RLS (use database).
- **Critical rules**: (1) Keep shared contracts canonical in `lib/contracts/`; no shadow DTOs. (2) Type-safe request/response handling; align with route handlers and client call sites. (3) Document breaking changes and migration for callers.
- **Boundaries**: Own types and contracts; do not change API implementation or schema.

## When to use this skill

- Task involves type errors, generic types, Zod, or contract drift.
- DTOs, request/response shapes, or inference need to be fixed or aligned.
- Contract-heavy change that affects both frontend and backend.

## Do not use for

- UI-only styling; backend-only logic with no contract change; schema/RLS (use database skill).

## Output / done

- Contract/type changes; aligned request/response and error codes.
- Notes on breaking changes and migration for callers.

## Handoff

When delegating: "Act as typescript-specialist per .cursor/agents/specialists/typescript-specialist/SKILL.md. Job and inputs: .cursor/agents/skills/typescript.md. Scope: [files/task]."
