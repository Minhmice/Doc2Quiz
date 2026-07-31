-- Workspaces, memberships, invitations, and shares.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subtitle text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_role_check check (role in ('owner', 'editor', 'viewer'))
);

alter table public.workspaces enable row level security;

alter table public.workspace_members enable row level security;

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

alter table public.workspace_invitations enable row level security;

alter table public.workspace_shares enable row level security;

create index if not exists workspaces_owner_active_idx
  on public.workspaces (owner_id, updated_at desc)
  where deleted_at is null;

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id);

create unique index if not exists workspace_invitations_live_unique
  on public.workspace_invitations (workspace_id, recipient_user_id)
  where accepted_at is null and revoked_at is null;

create index if not exists workspace_invitations_recipient_idx
  on public.workspace_invitations (recipient_user_id, created_at desc);

create index if not exists workspace_shares_workspace_idx
  on public.workspace_shares (workspace_id, created_at desc);
