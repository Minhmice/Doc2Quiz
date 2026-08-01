-- Workspace mutation/read RPCs call private.can_* helpers. security invoker runs as
-- the authenticated caller, who lacks USAGE on schema private (42501), so
-- persist_canonical_version and create_learning_output fail after AI/heuristic work.
-- Match create_workspace_document_version: security definer + explicit auth checks.

begin;

alter function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) security definer;

alter function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) set search_path = public, private;

alter function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) security definer;

alter function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) set search_path = public, private;

alter function public.resolve_learning_output_bridge(uuid, text)
  security definer;

alter function public.resolve_learning_output_bridge(uuid, text)
  set search_path = public, private;

commit;
