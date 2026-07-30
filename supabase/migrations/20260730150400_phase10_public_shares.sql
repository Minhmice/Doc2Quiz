-- Phase 10: public share resolver and digest-only authority hardening.
-- Timestamp 20260730150400 (plan asked 140200 — must run after 150300 collaboration).

begin;

-- ---------------------------------------------------------------------------
-- Public share resolver (service_role only; never anon/authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_public_share_by_digest(p_token_digest bytea)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.workspace_shares%rowtype;
  v_title text;
begin
  if p_token_digest is null or length(p_token_digest) <> 32 then
    raise exception 'not_found';
  end if;

  select * into v_share
  from public.workspace_shares s
  where s.token_digest = p_token_digest
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());

  if not found then
    raise exception 'not_found';
  end if;

  perform private.assert_workspace_share_target(
    v_share.workspace_id,
    v_share.target_kind,
    v_share.target_id,
    v_share.permission
  );

  if v_share.target_kind = 'workspace' then
    select w.title into v_title
    from public.workspaces w
    where w.id = v_share.workspace_id
      and w.deleted_at is null;

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'workspace',
        'title', v_title,
        'outputs', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', lo.id,
                'kind', case lo.kind
                  when 'quiz' then 'quiz'
                  when 'flashcards' then 'flashcard'
                end,
                'title', lo.title
              )
              order by lo.kind, lo.title
            )
            from public.learning_outputs lo
            where lo.workspace_id = v_share.workspace_id
              and lo.deleted_at is null
              and lo.status = 'ready'
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  if v_share.target_kind = 'quiz' then
    select lo.title into v_title
    from public.learning_outputs lo
    where lo.id = v_share.target_id
      and lo.workspace_id = v_share.workspace_id
      and lo.deleted_at is null
      and lo.kind = 'quiz'
      and lo.status = 'ready';

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'quiz',
        'title', v_title,
        'questions', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', aq.id,
                'prompt', aq.prompt,
                'choices', to_jsonb(aq.choices),
                'correctIndex', aq.correct_index,
                'explanation', aq.explanation
              )
              order by aq.created_at, aq.id
            )
            from public.approved_questions aq
            where aq.output_id = v_share.target_id
              and length(trim(aq.prompt)) > 0
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  if v_share.target_kind = 'flashcard' then
    select lo.title into v_title
    from public.learning_outputs lo
    where lo.id = v_share.target_id
      and lo.workspace_id = v_share.workspace_id
      and lo.deleted_at is null
      and lo.kind = 'flashcards'
      and lo.status = 'ready';

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'flashcard',
        'title', v_title,
        'cards', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', af.id,
                'front', af.front,
                'back', af.back
              )
              order by af.created_at, af.id
            )
            from public.approved_flashcards af
            where af.output_id = v_share.target_id
              and length(trim(af.front)) > 0
              and length(trim(af.back)) > 0
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  raise exception 'not_found';
exception
  when others then
    if sqlerrm in ('not_found', 'forbidden', 'invalid') then
      raise exception 'not_found';
    end if;
    raise;
end;
$$;

revoke all on function public.resolve_public_share_by_digest(bytea) from public;
revoke all on function public.resolve_public_share_by_digest(bytea) from anon;
revoke all on function public.resolve_public_share_by_digest(bytea) from authenticated;
grant execute on function public.resolve_public_share_by_digest(bytea) to service_role;

commit;
