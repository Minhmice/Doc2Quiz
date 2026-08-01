---
status: resolved
trigger: new row violates row-level security policy for table "workspaces"
created: 2026-07-30
updated: 2026-07-30
---

## Symptoms

- Error: `new row violates row-level security policy for table "workspaces"`
- Occurs on first workspace ingest (create study set / upload source)
- `create_workspace_document_version` RPC bootstraps workspace + membership + document

## Current Focus

hypothesis: `create_workspace_document_version` runs as `security invoker`, so bootstrap INSERTs hit RLS and fail atomically
test: change RPC to `security definer` with explicit `auth.uid()` + `can_edit_workspace` checks
expecting: first ingest succeeds; editor/viewer denial paths unchanged
next_action: apply migration `20260730150600_fix_create_workspace_document_version_rls.sql` to remote Supabase

## Evidence

- 2026-07-30: Phase 10 migration `20260730150200` replaced RPC with `security invoker` (line 649)
- 2026-07-30: Collaboration RPCs (`create_workspace_share`, etc.) use `security definer` — same bootstrap pattern
- 2026-07-30: `workspaces_insert_owner` RLS requires `owner_id = auth.uid()`; invoker bootstrap also needs `workspace_members` + `documents` policies in one transaction

## Resolution

root_cause: First-ingest RPC used `security invoker` while inserting into multiple RLS-protected tables; bootstrap path cannot satisfy policies in one invoker transaction.
fix: Migration `20260730150600_fix_create_workspace_document_version_rls.sql` — `security definer` + `search_path = public, private`, retains auth.uid() and can_edit_workspace guards.
verification: Re-run first ingest after `supabase db push` or apply migration in dashboard SQL editor.
files_changed:
  - supabase/migrations/20260730150600_fix_create_workspace_document_version_rls.sql
