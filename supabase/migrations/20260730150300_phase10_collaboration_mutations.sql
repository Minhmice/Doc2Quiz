-- Phase 10: collaboration invitations, share metadata, and owner-controlled mutation RPCs.
-- Timestamp 20260730150300 (plan asked 140100 — must run after 20260730150200 authorization).

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint workspace_invitations_role_check check (role in ('editor', 'viewer')),
  constraint workspace_invitations_recipient_not_creator check (recipient_user_id <> created_by)
);

create unique index if not exists workspace_invitations_live_unique
  on public.workspace_invitations (workspace_id, recipient_user_id)
  where accepted_at is null and revoked_at is null;

create index if not exists workspace_invitations_recipient_idx
  on public.workspace_invitations (recipient_user_id, created_at desc);

create table if not exists public.workspace_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  target_kind text not null,
  target_id uuid not null,
  token_digest bytea not null,
  permission text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  revoked_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint workspace_shares_target_kind_check check (target_kind in ('workspace', 'quiz', 'flashcard')),
  constraint workspace_shares_permission_check check (permission in ('view', 'study')),
  constraint workspace_shares_token_digest_unique unique (token_digest)
);

create index if not exists workspace_shares_workspace_idx
  on public.workspace_shares (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: members may not mutate directly; owner RPCs are authority
-- ---------------------------------------------------------------------------

alter table public.workspace_invitations enable row level security;
alter table public.workspace_shares enable row level security;

create policy workspace_invitations_select_owner on public.workspace_invitations
  for select to authenticated
  using ((select private.is_workspace_owner(workspace_id)));

create policy workspace_shares_select_owner on public.workspace_shares
  for select to authenticated
  using ((select private.is_workspace_owner(workspace_id)));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.assert_workspace_share_target(
  p_workspace_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_target_kind = 'workspace' then
    if p_target_id <> p_workspace_id then
      raise exception 'forbidden';
    end if;
    if p_permission <> 'view' then
      raise exception 'invalid';
    end if;
    if not exists (
      select 1 from public.workspaces w
      where w.id = p_workspace_id and w.deleted_at is null
    ) then
      raise exception 'not_found';
    end if;
    return;
  end if;

  if p_target_kind in ('quiz', 'flashcard') then
    if p_permission <> 'study' then
      raise exception 'invalid';
    end if;
    if not exists (
      select 1
      from public.learning_outputs lo
      where lo.id = p_target_id
        and lo.workspace_id = p_workspace_id
        and lo.deleted_at is null
        and lo.kind = case p_target_kind
          when 'quiz' then 'quiz'
          when 'flashcard' then 'flashcards'
        end
    ) then
      raise exception 'not_found';
    end if;
    return;
  end if;

  raise exception 'invalid';
end;
$$;

revoke all on function private.assert_workspace_share_target(uuid, text, uuid, text) from public;
revoke all on function private.assert_workspace_share_target(uuid, text, uuid, text) from anon;

-- ---------------------------------------------------------------------------
-- Invitation RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace_invitation(
  p_workspace_id uuid,
  p_recipient_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_recipient_user_id is null or p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;
  if p_recipient_user_id = v_uid then
    raise exception 'invalid';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.deleted_at is null
  ) then
    raise exception 'not_found';
  end if;

  insert into public.workspace_invitations (
    workspace_id, recipient_user_id, role, created_by, expires_at
  )
  values (
    p_workspace_id,
    p_recipient_user_id,
    p_role,
    v_uid,
    now() + interval '14 days'
  )
  returning * into v_invitation;

  return jsonb_build_object(
    'id', v_invitation.id,
    'workspaceId', v_invitation.workspace_id,
    'recipientUserId', v_invitation.recipient_user_id,
    'role', v_invitation.role,
    'expiresAt', v_invitation.expires_at,
    'createdAt', v_invitation.created_at
  );
exception
  when unique_violation then
    raise exception 'invitation_exists';
end;
$$;

create or replace function public.list_workspace_invitations(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'recipientUserId', i.recipient_user_id,
        'role', i.role,
        'expiresAt', i.expires_at,
        'acceptedAt', i.accepted_at,
        'revokedAt', i.revoked_at,
        'createdAt', i.created_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_invitations i
  where i.workspace_id = p_workspace_id
    and i.revoked_at is null
    and i.accepted_at is null;

  return jsonb_build_object('invitations', v_rows);
end;
$$;

create or replace function public.revoke_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_invitation
  from public.workspace_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if not (select private.is_workspace_owner(v_invitation.workspace_id)) then
    raise exception 'forbidden';
  end if;
  if v_invitation.accepted_at is not null or v_invitation.revoked_at is not null then
    raise exception 'not_found';
  end if;

  update public.workspace_invitations
  set revoked_at = now()
  where id = p_invitation_id;

  return jsonb_build_object('id', p_invitation_id, 'revoked', true);
end;
$$;

create or replace function public.accept_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_invitation
  from public.workspace_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_invitation.recipient_user_id <> v_uid then
    raise exception 'forbidden';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'not_found';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'expired';
  end if;
  if v_invitation.role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;

  if v_invitation.accepted_at is not null then
    select m.role into v_role
    from public.workspace_members m
    where m.workspace_id = v_invitation.workspace_id
      and m.user_id = v_uid;
    return jsonb_build_object(
      'workspaceId', v_invitation.workspace_id,
      'role', coalesce(v_role, v_invitation.role),
      'alreadyAccepted', true
    );
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invitation.workspace_id, v_uid, v_invitation.role)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  update public.workspace_invitations
  set accepted_at = now()
  where id = p_invitation_id;

  return jsonb_build_object(
    'workspaceId', v_invitation.workspace_id,
    'role', v_invitation.role,
    'alreadyAccepted', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Member RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', m.user_id,
        'role', m.role,
        'joinedAt', m.created_at
      )
      order by m.created_at
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_members m
  where m.workspace_id = p_workspace_id;

  return jsonb_build_object('members', v_rows);
end;
$$;

create or replace function public.change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.workspace_members%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;
  if p_user_id is null then
    raise exception 'invalid';
  end if;

  select * into v_member
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'forbidden';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'role', p_role);
end;
$$;

create or replace function public.revoke_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.workspace_members%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_user_id is null then
    raise exception 'invalid';
  end if;

  select * into v_member
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'forbidden';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'revoked', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Share metadata RPCs (token digest supplied by server route; never logged)
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace_share(
  p_workspace_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_token_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_share public.workspace_shares%rowtype;
  v_permission text;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_token_digest is null or length(p_token_digest) <> 32 then
    raise exception 'invalid';
  end if;

  v_permission := case p_target_kind
    when 'workspace' then 'view'
    when 'quiz' then 'study'
    when 'flashcard' then 'study'
    else null
  end;
  if v_permission is null then
    raise exception 'invalid';
  end if;

  perform private.assert_workspace_share_target(
    p_workspace_id, p_target_kind, p_target_id, v_permission
  );

  insert into public.workspace_shares (
    workspace_id, target_kind, target_id, token_digest, permission, created_by
  )
  values (
    p_workspace_id, p_target_kind, p_target_id, p_token_digest, v_permission, v_uid
  )
  returning * into v_share;

  return jsonb_build_object(
    'id', v_share.id,
    'workspaceId', v_share.workspace_id,
    'targetKind', v_share.target_kind,
    'targetId', v_share.target_id,
    'permission', v_share.permission,
    'createdAt', v_share.created_at
  );
end;
$$;

create or replace function public.list_workspace_shares(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'targetKind', s.target_kind,
        'targetId', s.target_id,
        'permission', s.permission,
        'expiresAt', s.expires_at,
        'revokedAt', s.revoked_at,
        'createdAt', s.created_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_shares s
  where s.workspace_id = p_workspace_id
    and s.revoked_at is null;

  return jsonb_build_object('shares', v_rows);
end;
$$;

create or replace function public.revoke_workspace_share(p_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_share public.workspace_shares%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_share
  from public.workspace_shares s
  where s.id = p_share_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if not (select private.is_workspace_owner(v_share.workspace_id)) then
    raise exception 'forbidden';
  end if;
  if v_share.revoked_at is not null then
    raise exception 'not_found';
  end if;

  update public.workspace_shares
  set revoked_at = now()
  where id = p_share_id;

  return jsonb_build_object('id', p_share_id, 'revoked', true);
end;
$$;

grant execute on function public.create_workspace_invitation(uuid, uuid, text) to authenticated;
grant execute on function public.list_workspace_invitations(uuid) to authenticated;
grant execute on function public.revoke_workspace_invitation(uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.change_workspace_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.create_workspace_share(uuid, text, uuid, bytea) to authenticated;
grant execute on function public.list_workspace_shares(uuid) to authenticated;
grant execute on function public.revoke_workspace_share(uuid) to authenticated;

commit;
