-- Phase 10: anonymous quiz attempt import markers and idempotent importer RPC.
-- Timestamp 20260730150500 (plan asked 140300 — must run after 150400 public shares).

begin;

-- ---------------------------------------------------------------------------
-- Import marker table (personal history for shared-quiz study)
-- ---------------------------------------------------------------------------

create table if not exists public.anonymous_quiz_attempt_imports (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_attempt_id uuid not null,
  share_id uuid not null references public.workspace_shares (id) on delete restrict,
  output_id uuid not null references public.learning_outputs (id) on delete restrict,
  attempt jsonb not null,
  completed_at timestamptz not null,
  imported_at timestamptz not null default now(),
  constraint anonymous_quiz_attempt_imports_pkey primary key (user_id, client_attempt_id),
  constraint anonymous_quiz_attempt_imports_attempt_size_check
    check (octet_length(attempt::text) <= 32768)
);

create index if not exists anonymous_quiz_attempt_imports_user_imported_idx
  on public.anonymous_quiz_attempt_imports (user_id, imported_at desc);

alter table public.anonymous_quiz_attempt_imports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'anonymous_quiz_attempt_imports'
      and policyname = 'anonymous_quiz_attempt_imports_select_own'
  ) then
    create policy anonymous_quiz_attempt_imports_select_own
      on public.anonymous_quiz_attempt_imports
      for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent batch importer (authenticated only)
-- ---------------------------------------------------------------------------

create or replace function public.import_anonymous_quiz_attempts(p_attempts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_entry jsonb;
  v_client_attempt_id uuid;
  v_share_id uuid;
  v_output_id uuid;
  v_completed_at timestamptz;
  v_answers jsonb;
  v_attempt jsonb;
  v_share public.workspace_shares%rowtype;
  v_answer jsonb;
  v_question_id uuid;
  v_selected_index integer;
  v_answer_count integer;
  v_valid_question_count integer;
  v_acknowledged uuid[] := '{}';
  v_inserted uuid;
  v_i integer;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array' then
    raise exception 'invalid';
  end if;

  if jsonb_array_length(p_attempts) = 0 then
    return jsonb_build_object('acknowledgedIds', '[]'::jsonb);
  end if;

  if jsonb_array_length(p_attempts) > 20 then
    raise exception 'invalid';
  end if;

  if octet_length(p_attempts::text) > 262144 then
    raise exception 'invalid';
  end if;

  for v_i in 0 .. jsonb_array_length(p_attempts) - 1 loop
    begin
      v_entry := p_attempts -> v_i;

      v_client_attempt_id := nullif(v_entry ->> 'clientAttemptId', '')::uuid;
      v_share_id := nullif(v_entry ->> 'shareId', '')::uuid;
      v_output_id := nullif(v_entry ->> 'outputId', '')::uuid;
      v_completed_at := nullif(v_entry ->> 'completedAt', '')::timestamptz;
      v_answers := v_entry -> 'answers';

      if v_client_attempt_id is null
        or v_share_id is null
        or v_output_id is null
        or v_completed_at is null
        or jsonb_typeof(v_answers) <> 'array'
      then
        continue;
      end if;

      if v_completed_at > now() + interval '5 minutes'
        or v_completed_at < now() - interval '365 days'
      then
        continue;
      end if;

      v_answer_count := jsonb_array_length(v_answers);
      if v_answer_count = 0 or v_answer_count > 500 then
        continue;
      end if;

      v_attempt := jsonb_build_object(
        'answers', v_answers,
        'correctCount', coalesce((v_entry ->> 'correctCount')::integer, 0),
        'totalQuestions', coalesce((v_entry ->> 'totalQuestions')::integer, 0)
      );

      if octet_length(v_attempt::text) > 32768 then
        continue;
      end if;

      for v_answer in select value from jsonb_array_elements(v_answers) loop
        v_question_id := nullif(v_answer ->> 'questionId', '')::uuid;
        v_selected_index := (v_answer ->> 'selectedIndex')::integer;

        if v_question_id is null
          or v_selected_index is null
          or v_selected_index < 0
          or v_selected_index > 25
        then
          raise exception 'skip_entry';
        end if;
      end loop;

      select * into v_share
      from public.workspace_shares s
      where s.id = v_share_id
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
        and s.target_kind = 'quiz'
        and s.target_id = v_output_id
        and s.permission = 'study';

      if not found then
        continue;
      end if;

      if not exists (
        select 1
        from public.learning_outputs lo
        where lo.id = v_output_id
          and lo.workspace_id = v_share.workspace_id
          and lo.deleted_at is null
          and lo.kind = 'quiz'
          and lo.status = 'ready'
      ) then
        continue;
      end if;

      select count(*) into v_valid_question_count
      from public.approved_questions aq
      where aq.output_id = v_output_id
        and aq.id in (
          select nullif(value ->> 'questionId', '')::uuid
          from jsonb_array_elements(v_answers)
        );

      if v_valid_question_count <> v_answer_count then
        continue;
      end if;

      insert into public.anonymous_quiz_attempt_imports (
        user_id,
        client_attempt_id,
        share_id,
        output_id,
        attempt,
        completed_at
      )
      values (
        v_uid,
        v_client_attempt_id,
        v_share_id,
        v_output_id,
        v_attempt,
        v_completed_at
      )
      on conflict (user_id, client_attempt_id) do nothing
      returning client_attempt_id into v_inserted;

      if v_inserted is not null then
        v_acknowledged := array_append(v_acknowledged, v_inserted);
      elsif exists (
        select 1
        from public.anonymous_quiz_attempt_imports i
        where i.user_id = v_uid
          and i.client_attempt_id = v_client_attempt_id
      ) then
        v_acknowledged := array_append(v_acknowledged, v_client_attempt_id);
      end if;
    exception
      when others then
        if sqlerrm = 'skip_entry' then
          continue;
        end if;
        continue;
    end;
  end loop;

  return jsonb_build_object(
    'acknowledgedIds',
    coalesce(
      (
        select jsonb_agg(to_jsonb(id))
        from unnest(v_acknowledged) as id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.import_anonymous_quiz_attempts(jsonb) from public;
revoke all on function public.import_anonymous_quiz_attempts(jsonb) from anon;
grant execute on function public.import_anonymous_quiz_attempts(jsonb) to authenticated;

-- Expose quiz output id for anonymous outbox enqueue (safe projection field).
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
        'outputId', v_share.target_id,
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
