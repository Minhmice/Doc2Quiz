begin;

create or replace function private.direct_message_attachments_valid(p_attachments jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v_item jsonb;
  v_size bigint;
begin
  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) > 5 then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_attachments) loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['id', 'name', 'mimeType', 'sizeBytes', 'path'])
      or jsonb_typeof(v_item->'id') <> 'string'
      or jsonb_typeof(v_item->'name') <> 'string'
      or jsonb_typeof(v_item->'mimeType') <> 'string'
      or jsonb_typeof(v_item->'sizeBytes') <> 'number'
      or jsonb_typeof(v_item->'path') <> 'string'
      or (v_item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (v_item->>'name') !~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$'
      or (v_item->>'mimeType') not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime')
      or (v_item->>'sizeBytes') !~ '^[0-9]+(\\.[0-9]+)?$'
      or (v_item->>'path') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/messages/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm|mov)$' then
      return false;
    end if;
    v_size := trunc((v_item->>'sizeBytes')::numeric)::bigint;
    if (v_item->>'sizeBytes')::numeric <> v_size then
      return false;
    end if;
    if v_size < 0 or v_size > 20971520 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.direct_message_attachments_valid(jsonb) from public, anon, authenticated;

alter table public.direct_messages alter column body drop not null;
alter table public.direct_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages drop constraint if exists direct_messages_content_check;
alter table public.direct_messages drop constraint if exists direct_messages_attachments_check;
alter table public.direct_messages add constraint direct_messages_content_check check (
  (body is not null and char_length(body) between 1 and 2000 and body = btrim(body))
  or (body is null and jsonb_array_length(attachments) > 0)
);
alter table public.direct_messages add constraint direct_messages_attachments_check check (private.direct_message_attachments_valid(attachments));

create table if not exists public.direct_message_attachments (
  id uuid primary key,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  path text not null unique,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  extension text not null,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  consumed_at timestamptz null,
  constraint direct_message_attachments_path_check check (path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/messages/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm|mov)$'),
  constraint direct_message_attachments_name_check check (name ~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$'),
  constraint direct_message_attachments_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime')),
  constraint direct_message_attachments_size_check check (size_bytes between 0 and 20971520),
  constraint direct_message_attachments_extension_check check (extension in ('jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov')),
  constraint direct_message_attachments_status_check check (status in ('uploaded', 'consumed')),
  constraint direct_message_attachments_consumed_check check ((status = 'uploaded' and consumed_at is null) or (status = 'consumed' and consumed_at is not null))
);
create index if not exists direct_message_attachments_owner_conversation_idx
  on public.direct_message_attachments (uploader_id, conversation_id, status);

alter table public.direct_message_attachments enable row level security;
revoke all on table public.direct_message_attachments from public, anon, authenticated;

create or replace function public.authorize_direct_message_upload(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
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
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.register_direct_message_upload(
  p_attachment_id uuid,
  p_conversation_id uuid,
  p_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_extension text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
  v_path text;
  v_expected_extension text;
begin
  if v_user_id is null or p_attachment_id is null or p_conversation_id is null
    or p_name !~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$'
    or p_size_bytes not between 0 and 20971520
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime')
    or p_extension not in ('jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov') then
    raise exception 'social_unavailable';
  end if;

  v_expected_extension := case p_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'image/gif' then 'gif'
    when 'video/mp4' then 'mp4'
    when 'video/webm' then 'webm'
    when 'video/quicktime' then 'mov'
  end;
  if p_extension <> v_expected_extension then raise exception 'social_unavailable'; end if;

  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end
    into v_other_user_id
  from public.direct_conversations c
  where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then
    raise exception 'social_unavailable';
  end if;

  v_path := format('%s/messages/%s/%s.%s', v_user_id, p_conversation_id, p_attachment_id, p_extension);
  if not exists (select 1 from storage.objects where bucket_id = 'doc2quiz' and name = v_path) then
    raise exception 'social_unavailable';
  end if;

  insert into public.direct_message_attachments (id, uploader_id, conversation_id, path, name, mime_type, size_bytes, extension)
  values (p_attachment_id, v_user_id, p_conversation_id, v_path, p_name, p_mime_type, p_size_bytes, p_extension);
  return jsonb_build_object('id', p_attachment_id, 'name', p_name, 'mimeType', p_mime_type, 'sizeBytes', p_size_bytes);
exception when unique_violation then
  raise exception 'social_unavailable';
end;
$$;

create or replace function public.discard_direct_message_uploads(p_conversation_id uuid, p_attachment_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_paths jsonb;
  v_count integer;
begin
  if v_user_id is null or p_conversation_id is null or p_attachment_ids is null
    or cardinality(p_attachment_ids) < 1 or cardinality(p_attachment_ids) > 5 then
    raise exception 'social_unavailable';
  end if;
  select count(*) into v_count
  from public.direct_message_attachments a
  where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id
    and a.status = 'uploaded' and a.id = any(p_attachment_ids);
  if v_count <> cardinality(p_attachment_ids) then raise exception 'social_unavailable'; end if;
  select coalesce(jsonb_agg(a.path), '[]'::jsonb) into v_paths
  from public.direct_message_attachments a
  where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id
    and a.status = 'uploaded' and a.id = any(p_attachment_ids);
  delete from public.direct_message_attachments a
  where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id
    and a.status = 'uploaded' and a.id = any(p_attachment_ids);
  return jsonb_build_object('paths', v_paths);
end;
$$;

create or replace function public.list_direct_messages(p_conversation_id uuid, p_before timestamptz default null, p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_messages jsonb;
begin
  if v_user_id is null or p_conversation_id is null or p_limit not between 1 and 100 then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id
  from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'senderId', sender_id, 'body', body, 'attachments', attachments, 'createdAt', created_at) order by created_at desc), '[]'::jsonb)
  into v_messages from (select * from public.direct_messages where conversation_id = p_conversation_id and (p_before is null or created_at < p_before) order by created_at desc limit p_limit) m;
  return jsonb_build_object('messages', v_messages);
end;
$$;

create or replace function public.send_direct_message(p_conversation_id uuid, p_body text, p_attachment_ids uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
  v_message_id uuid;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_attachments jsonb := '[]'::jsonb;
  v_count integer := coalesce(cardinality(p_attachment_ids), 0);
begin
  if v_user_id is null or p_conversation_id is null or v_count > 5 or (v_body is null and v_count = 0) then raise exception 'social_unavailable'; end if;
  if v_body is not null and char_length(v_body) > 2000 then raise exception 'social_unavailable'; end if;
  if v_count > 0 and (select count(*) from (select distinct unnest(p_attachment_ids)) ids) <> v_count then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id
  from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id) for update;
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;

  if v_count > 0 then
    perform 1 from public.direct_message_attachments a
    where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id and a.status = 'uploaded' and a.id = any(p_attachment_ids)
    for update;
    if (select count(*) from public.direct_message_attachments a where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id and a.status = 'uploaded' and a.id = any(p_attachment_ids)) <> v_count then raise exception 'social_unavailable'; end if;
    if exists (
      select 1 from public.direct_message_attachments a
      where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id and a.status = 'uploaded' and a.id = any(p_attachment_ids)
        and not exists (select 1 from storage.objects o where o.bucket_id = 'doc2quiz' and o.name = a.path)
    ) then raise exception 'social_unavailable'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mimeType', a.mime_type, 'sizeBytes', a.size_bytes, 'path', a.path) order by a.created_at), '[]'::jsonb)
      into v_attachments
    from public.direct_message_attachments a
    where a.uploader_id = v_user_id and a.conversation_id = p_conversation_id and a.status = 'uploaded' and a.id = any(p_attachment_ids);
  end if;

  insert into public.direct_messages(conversation_id, sender_id, body, attachments)
  values (p_conversation_id, v_user_id, v_body, v_attachments)
  returning id into v_message_id;
  update public.direct_message_attachments set status = 'consumed', consumed_at = now()
  where uploader_id = v_user_id and conversation_id = p_conversation_id and status = 'uploaded' and id = any(p_attachment_ids);
  update public.direct_conversations set last_message_at = now() where id = p_conversation_id;
  return jsonb_build_object('id', v_message_id, 'senderId', v_user_id, 'recipientUserId', v_other_user_id, 'body', v_body, 'attachments', v_attachments, 'createdAt', now());
end;
$$;

drop function if exists public.send_direct_message(uuid, text);
revoke all on function public.authorize_direct_message_upload(uuid), public.register_direct_message_upload(uuid, uuid, text, text, bigint, text), public.discard_direct_message_uploads(uuid, uuid[]), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text, uuid[]) from public, anon;
grant execute on function public.authorize_direct_message_upload(uuid), public.register_direct_message_upload(uuid, uuid, text, text, bigint, text), public.discard_direct_message_uploads(uuid, uuid[]), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text, uuid[]) to authenticated;
revoke all on table public.direct_conversations, public.direct_messages, public.direct_message_attachments from public, anon, authenticated;

commit;
