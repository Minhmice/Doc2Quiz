begin;

create table if not exists private.social_activity_events (
  event_id uuid primary key,
  dedupe_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_kind text not null check (activity_kind in ('presence_transition', 'message_sent', 'conversation_read')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (char_length(dedupe_key) between 1 and 96)
);

revoke all on table private.social_activity_events from public, anon, authenticated;

create or replace function public.apply_social_activity_batch(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_inserted integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then
    raise exception 'invalid_activity_batch';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_events) item
    where item ?| array['body', 'token', 'ip', 'study_action']
       or item->>'activityKind' not in ('presence_transition', 'message_sent', 'conversation_read')
       or item->>'source' not in ('heartbeat', 'message', 'client')
       or item->>'eventId' is null
       or item->>'userId' is null
       or item->>'occurredAt' is null
       or item->>'dedupeKey' is null
       or char_length(item->>'dedupeKey') > 96
  ) then
    raise exception 'invalid_activity_batch';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(p_events) as event(
      "eventId" uuid,
      "userId" uuid,
      "occurredAt" timestamptz,
      "activityKind" text,
      source text,
      "dedupeKey" text
    )
  ), deduped_input as (
    select distinct on ("dedupeKey") *
    from input
    order by "dedupeKey", "occurredAt" desc
  ), inserted as (
    insert into private.social_activity_events (event_id, dedupe_key, user_id, activity_kind, occurred_at)
    select "eventId", "dedupeKey", "userId", "activityKind", "occurredAt"
    from deduped_input
    on conflict do nothing
    returning user_id, activity_kind, occurred_at
  ), newest as (
    select distinct on (user_id, activity_kind, date_trunc('minute', occurred_at))
      user_id, occurred_at
    from inserted
    order by user_id, activity_kind, date_trunc('minute', occurred_at), occurred_at desc
  ), upserted as (
    insert into private.social_activity (user_id, last_active_at)
    select user_id, max(occurred_at)
    from newest
    group by user_id
    on conflict (user_id) do update
      set last_active_at = greatest(private.social_activity.last_active_at, excluded.last_active_at)
    returning 1
  )
  select count(*) into v_inserted from upserted;

  delete from private.social_activity_events
  where created_at < now() - interval '24 hours';

  return v_inserted;
end;
$$;

revoke all on function public.apply_social_activity_batch(jsonb) from public, anon, authenticated;
grant execute on function public.apply_social_activity_batch(jsonb) to service_role;

commit;
