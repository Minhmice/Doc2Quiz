---
status: fixing
trigger: POST /api/workspaces/.../canonicalize returns 503 after AI 520 heuristic fallback
created: 2026-07-31
updated: 2026-07-31
---

## Symptoms

- Expected: workspace canonicalize succeeds via heuristic fallback when AI gateway returns 520
- Actual: `POST .../canonicalize` returns **503** after ~45s; log shows AI fallback ran
- Workspace: `ad10593f-fad4-4b9b-943e-4aa742048130`, document version `15245d38-c745-435d-98fc-5321775579f6`
- File: `detienganhnghean.pdf` (~39k chars markdown)

## Current Focus

hypothesis: `persist_canonical_version` is `security invoker` and calls `private.can_edit_workspace`; authenticated role lacks USAGE on schema `private` → SQLSTATE 42501
test: authenticated owner RPC `persist_canonical_version` with heuristic payload
expecting: `permission denied for schema private` before fix; success after migration
next_action: apply `20260730192000_fix_workspace_rpc_private_schema.sql` to remote Supabase and re-run canonicalize

## Evidence

- 2026-07-31: Terminal log — AI 520, heuristic fallback logged, route 503 (`CanonicalVersionPersistenceError`)
- 2026-07-31: Service-role smoke RPC returns `Authentication required` (RPC exists)
- 2026-07-31: Authenticated owner via magic-link OTP — `persist_canonical_version` error `permission denied for schema private` (code 42501)
- 2026-07-31: Same error on `create_learning_output` (same invoker + private.can_edit_workspace pattern)
- 2026-07-31: Heuristic builder produces 1 section, no duplicate keys; not a payload/validation issue
- 2026-07-31: Prior fix `20260730150600` used `security definer` for `create_workspace_document_version` (RLS/bootstrap); same class of invoker + private helper failure

## Eliminated

- hypothesis: Heuristic output invalid or empty sections
  falsification: 1 valid section, checksums computed, Zod would have thrown 422 not 503

- hypothesis: AI 520 is the terminal failure
  falsification: log confirms heuristic fallback; 503 maps only to persistence error class

## Resolution

root_cause: Phase 10 workspace RPCs (`persist_canonical_version`, `create_learning_output`, `resolve_learning_output_bridge`) use `security invoker` while calling `private.can_edit_workspace` / `private.can_view_workspace`. Authenticated JWT callers lack USAGE on schema `private`, so PostgREST RPC fails with 42501 after canonicalization completes.
fix: Migration `supabase/migrations/20260730192000_fix_workspace_rpc_private_schema.sql` — `SECURITY DEFINER` + `search_path = public, private` (RPC bodies already enforce `auth.uid()` and role checks).
verification: Re-run authenticated persist script; POST workspace canonicalize on `detienganhnghean` workspace.
files_changed:
  - supabase/migrations/20260730192000_fix_workspace_rpc_private_schema.sql
