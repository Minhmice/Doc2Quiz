begin;

create or replace function public.authorize_conversation_typing(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
begin
  if v_user_id is null or p_conversation_id is null then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end
  into v_other_user_id
  from public.direct_conversations c
  where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then
    raise exception 'social_unavailable';
  end if;
  return jsonb_build_object('participantIds', jsonb_build_array(v_user_id, v_other_user_id));
end;
$$;

revoke all on function public.authorize_conversation_typing(uuid) from public, anon;
grant execute on function public.authorize_conversation_typing(uuid) to authenticated;

commit;
