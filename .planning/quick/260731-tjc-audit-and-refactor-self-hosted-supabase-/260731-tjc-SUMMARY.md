---
phase: quick-self-hosted-supabase-architecture
plan: 01
status: incomplete
subsystem: database
tags: [postgresql, supabase, schema, rls, security]
requires:
  - phase: migration-history
    provides: immutable production upgrade ledger and exact profiles foundation
provides:
  - migration immutability verification
  - documented canonicalization blockers
affects: [database, self-hosting, security, testing]
tech-stack:
  added: []
  patterns: [immutable migration hash gate, direct-psql validation]
key-files:
  created:
    - .planning/quick/260731-tjc-audit-and-refactor-self-hosted-supabase-/260731-tjc-SUMMARY.md
  modified: []
key-decisions:
  - "Do not invent public.profiles foundation or auth provisioning behavior absent from repository evidence."
  - "Do not claim canonical parity without disposable self-hosted database URLs and psql."
requirements-completed: []
duration: 8min
completed: 2026-07-31
---

# Quick Plan 260731-tjc: Self-hosted Supabase Audit Summary

**Canonical schema work stopped before DDL creation because required profile foundation evidence and executable self-hosted PostgreSQL validation environment are absent.**

## Status

Incomplete. No plan task met its done criteria, so no canonical SQL, tests, or seed were created.

## Completed Investigation

- Read plan and project state.
- Generated sorted SHA-256 hashes for every current `supabase/migrations/*.sql` file in temporary untracked output.
- Recomputed hashes after investigation: all 35 current migration files remained byte-identical.
- Scanned application database callers under `src/**/*.{ts,tsx,js,jsx}` for `.from()`, `.rpc()`, and storage bucket usage.
- Searched repository SQL for `public.profiles` creation and auth-user provisioning trigger/function; no source exists.
- Confirmed `psql`, `TEST_DATABASE_URL`, and `CANONICAL_TEST_DATABASE_URL` are unavailable.
- Confirmed no existing migration was edited, renamed, deleted, reordered, staged, or committed.
- Left unrelated `.env.example` and `.next/**` changes untouched.

## Blockers

1. **Missing authoritative `public.profiles` foundation**
   - Migration history alters and consumes `public.profiles` but does not create its base table or auth-user provisioning trigger.
   - Plan explicitly forbids inventing this contract and requires unresolved prerequisite to stop execution.
   - Required next input: exact SQL source defining base profile columns, keys, grants, policies, and `auth.users` provisioning behavior, or confirmation that this is a platform prerequisite with its exact catalog contract.

2. **No disposable self-hosted Supabase PostgreSQL target**
   - `TEST_DATABASE_URL` and `CANONICAL_TEST_DATABASE_URL` are unset.
   - Catalog extraction, migration-built versus canonical-built parity, RLS role tests, storage/realtime policy tests, and repeatable seed checks cannot run safely.
   - Required next input: approved disposable URLs. Never supply production URLs.

3. **`psql` unavailable on PATH**
   - Direct PostgreSQL checks requested by plan cannot run.
   - Required next input: install/configure trusted PostgreSQL client and expose `psql` on PATH.

4. **Plan baseline differs from worktree**
   - Plan states 34 migrations ending at `20260731190000_onboarding_mvp.sql`.
   - Worktree currently contains 35 migrations, including later `20260731210000_profile_theme_preference.sql`.
   - Several migration files are untracked. They were treated as immutable user work and left untouched.
   - Plan/catalog inventory must include current 35-file ledger before canonicalization.

## Tasks

- Task 1: incomplete — caller scan and hash gate performed; executable catalog assertions blocked.
- Task 2: not started — authoritative profile prerequisite and catalog DB absent.
- Task 3: not started — depends on canonical foundations and catalog DB.
- Task 4: not started — exact final signatures/ACL parity cannot be proven without catalog DB.
- Task 5: not started — RLS/realtime/storage parity cannot be proven without self-hosted Supabase DB.
- Task 6: not started — canonical build, seed repeatability, and two-database parity unavailable.

## Behavior Change and Application Callers

No behavior change. No application source file changed. Existing table, RPC, and `doc2quiz` storage callers remain untouched.

## Files Created/Modified

- `.planning/quick/260731-tjc-audit-and-refactor-self-hosted-supabase-/260731-tjc-SUMMARY.md` — incomplete execution evidence and blockers.

## Validation Results

- Migration SHA-256 before/after comparison: **PASS**, 35 of 35 unchanged.
- `git diff -- supabase/migrations`: **PASS**, no tracked migration edits.
- Repository profile foundation search: **BLOCKED**, no base DDL/provisioning source found.
- Direct `psql` schema/tests: **NOT RUN**, client and safe database URLs unavailable.
- Canonical lexical load: **NOT RUN**, canonical files intentionally not fabricated.
- Migration/canonical catalog parity: **NOT RUN**, two disposable databases unavailable.
- RLS/RPC/storage behavior tests: **NOT RUN**, self-hosted Supabase database unavailable.

## Deviations from Plan

None. Execution stopped at plan-mandated prerequisite rather than inventing schema or weakening validation.

## Self-Check: PASSED

Summary exists. Claims match observed repository and environment state. `status: incomplete` accurately reflects zero completed implementation tasks.
