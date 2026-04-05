# Skill: Database / Schema / RLS

## Job (what this skill must do)

Design and change schema, migrations, RLS policies, and data integrity. Own SQL migrations, indexes, and ownership/security at the data layer. Coordinate with backend for service-layer alignment.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/database-specialist/SKILL.md` — act as **database-specialist**.
- **Context**: `supabase/migrations/`; RLS policies; tables (e.g. folders, files, share_links, activity_logs, workspace_preferences); backend services that assume ownership and RLS.
- **Specialist search**: `python3 .cursor/agents/specialists/database-specialist/scripts/search.py "<query>"` for local curated schema and migration guidance.

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: Schema changes, new migrations, RLS updates, data integrity; query optimization, indexing, N+1 prevention; ownership or row-level security; data consolidation.
- **Do not invoke when**: API route logic only (use backend); UI only (use frontend); infra/CI (use devops).
- **Critical rules**: (1) Always check query plans (EXPLAIN ANALYZE) before deploying. (2) Index foreign keys for joins. (3) Avoid SELECT *; fetch only needed columns. (4) Use connection pooling; never open connections per request. (5) Migrations must be reversible (DOWN migrations). (6) Never lock tables in production—use CONCURRENTLY for indexes. (7) Prevent N+1: JOINs or batch loading. (8) Coordinate with backend for service-layer alignment.
- **Boundaries**: Own schema/RLS/migrations; backend owns route and service logic.

## When to use this skill

- Task involves schema changes, new migrations, RLS updates, or data integrity.
- Ownership or row-level security is part of the fix or feature.

## Do not use for

- API route logic only (use backend); UI only (use frontend); infra/CI (use devops).

## Output / done

- Migration files and RLS policy changes.
- Notes on compatibility and backend impact.
- Verification that services still respect ownership.

## Handoff

When delegating: "Act as database-specialist per .cursor/agents/specialists/database-specialist/SKILL.md. Job and inputs: .cursor/agents/skills/database.md. Scope: [files/task]."
