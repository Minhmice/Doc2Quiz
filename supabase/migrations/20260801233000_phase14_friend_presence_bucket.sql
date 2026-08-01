begin;

create or replace function public.list_social_friends(
  p_limit integer,
  p_cursor jsonb default null,
  p_presence text default 'offline'
) returns jsonb
language sql
security definer
set search_path = public
as $$
with owned as (
  select case when fr.sender_id = auth.uid() then fr.recipient_id else fr.sender_id end user_id
  from public.friend_requests fr
  where auth.uid() is not null
    and fr.status = 'accepted'
    and auth.uid() in (fr.sender_id, fr.recipient_id)
), rows as (
  select
    o.user_id,
    p.username,
    case
      when a.last_active_at >= now() - interval '5 minutes' then 0
      when a.last_active_at is not null then 1
      else 2
    end presence_rank,
    a.last_active_at
  from owned o
  join public.profiles p on p.id = o.user_id
  left join private.social_activity a on a.user_id = o.user_id
  where not private.social_users_blocked(auth.uid(), o.user_id)
    and p_presence in ('online', 'offline')
    and (
      (p_presence = 'online' and case when a.last_active_at >= now() - interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end = 0)
      or (p_presence = 'offline' and case when a.last_active_at >= now() - interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end in (1, 2))
    )
), page as (
  select *
  from rows
  where p_cursor is null
     or (presence_rank, coalesce(username, ''), user_id::text) > ((p_cursor->>0)::int, p_cursor->>1, p_cursor->>2)
  order by presence_rank, coalesce(username, ''), user_id
  limit least(greatest(p_limit, 1), 51)
)
select jsonb_build_object(
  'items', coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'username', username,
      'presenceRank', presence_rank,
      'presence', case presence_rank when 0 then 'online' when 1 then 'recently_active' else 'offline' end,
      'lastActiveAt', last_active_at
    ) order by presence_rank, coalesce(username, ''), user_id
  ), '[]'),
  'totalCount', (select count(*) from rows)
)
from page
$$;

revoke all on function public.list_social_friends(integer, jsonb, text) from public, anon;
grant execute on function public.list_social_friends(integer, jsonb, text) to authenticated;

commit;
