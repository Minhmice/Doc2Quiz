-- Friend, messaging, reaction, notification, and study-together relations.

create table if not exists private.social_friend_request_events (
  id bigserial primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint friend_requests_no_self check (sender_id <> recipient_id)
);

alter table public.friend_requests enable row level security;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text null,
  created_at timestamptz not null default now(),
  constraint user_reports_reason_len check (char_length(reason) between 1 and 120),
  constraint user_reports_details_len check (details is null or char_length(details) <= 500),
  constraint user_reports_no_self check (reporter_id <> reported_user_id)
);

alter table public.user_reports enable row level security;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint direct_conversations_distinct_users check (user_low_id < user_high_id),
  unique (user_low_id, user_high_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000 and body = btrim(body)),
  created_at timestamptz not null default now()
);

create table if not exists private.social_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now()
);

create table if not exists public.reaction_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  blocked_sender_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  constraint reaction_preferences_no_null_blocks check (array_position(blocked_sender_ids, null) is null)
);

alter table public.direct_conversations enable row level security;

alter table public.direct_messages enable row level security;

alter table public.reaction_preferences enable row level security;

create table if not exists public.learning_output_friend_shares (
  output_id uuid primary key references public.learning_outputs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.learning_output_friend_shares enable row level security;

create table if not exists public.direct_conversation_participants (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.direct_conversation_participants enable row level security;

create table public.study_together_sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'asynchronous_challenge' check (type in ('asynchronous_challenge','live_session')),
  source_type text not null default 'owned_quiz' check (source_type in ('owned_quiz','friend_shared_quiz')),
  creator_id uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  source_output_id uuid null,
  source_owner_id uuid not null references auth.users(id) on delete restrict,
  source_version text not null,
  snapshot_hash text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot->'questions') = 'array' and jsonb_array_length(snapshot->'questions') > 0),
  mode text not null check (mode in ('practice','score')),
  deadline_at timestamptz null,
  result_reveal_policy text not null default 'after_both_complete' check (result_reveal_policy in ('immediate','after_both_complete','after_deadline')),
  status text not null default 'pending' check (status in ('pending','active','completed','expired','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz null,
  check (creator_id <> recipient_id), check (type = 'asynchronous_challenge'), check (source_type = 'owned_quiz')
);

create table public.study_together_participants (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_together_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict, role text not null check (role in ('creator','recipient')),
  status text not null check (status in ('invited','not_started','in_progress','completed','declined')),
  score integer null, accuracy numeric(5,2) null, duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0), completed_at timestamptz null,
  unique(session_id,user_id), unique(session_id,role)
);

create table public.study_together_attempts (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_together_sessions(id) on delete cascade,
  participant_id uuid not null references public.study_together_participants(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number = 1), status text not null default 'in_progress' check (status in ('in_progress','completed')),
  selected_indices jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_indices) = 'array'), current_question_index integer not null default 0 check (current_question_index >= 0),
  score integer null, question_count integer null, accuracy numeric(5,2) null, duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  started_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz null,
  unique(session_id,participant_id,attempt_number)
);

create table public.social_notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id) on delete cascade, actor_id uuid null references auth.users(id) on delete set null,
  type text not null check (type in ('study_challenge_received','study_challenge_accepted','study_challenge_declined','study_challenge_completed','study_challenge_result_ready','study_challenge_expiring')),
  entity_type text not null default 'study_session' check (entity_type = 'study_session'), entity_id uuid not null, payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null, created_at timestamptz not null default now(), read_at timestamptz null, archived_at timestamptz null,
  unique(recipient_id,dedupe_key)
);

create table public.social_reactions (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid not null references auth.users(id) on delete cascade,
  reaction_id text not null check (char_length(reaction_id) between 1 and 40), entity_type text not null, entity_id uuid not null, dedupe_key text not null, created_at timestamptz not null default now(),
  check(sender_id <> recipient_id), unique(sender_id,dedupe_key)
);

alter table public.study_together_sessions enable row level security;

alter table public.study_together_participants enable row level security;

alter table public.study_together_attempts enable row level security;

alter table public.social_notifications enable row level security;

alter table public.social_reactions enable row level security;

create index if not exists social_friend_request_events_sender_created_idx
  on private.social_friend_request_events (sender_id, created_at desc);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);

create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

create unique index if not exists friend_requests_pending_pair_unique
  on public.friend_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  )
  where status = 'pending';

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc);

create index if not exists direct_conversations_last_message_idx
  on public.direct_conversations (last_message_at desc);

create index if not exists social_activity_last_active_idx
  on private.social_activity (last_active_at desc);

create index if not exists direct_conversation_participants_user_read_idx
  on public.direct_conversation_participants (user_id, read_at);

create index study_together_sessions_recipient_status_idx on public.study_together_sessions(recipient_id,status,created_at desc);

create index study_together_sessions_creator_status_idx on public.study_together_sessions(creator_id,status,created_at desc);

create index social_notifications_unread_idx on public.social_notifications(recipient_id,created_at desc) where read_at is null and archived_at is null;

create index if not exists friend_requests_social_page_idx on public.friend_requests(status,created_at desc,id desc);

create index if not exists user_blocks_owner_page_idx on public.user_blocks(blocker_id,created_at desc,blocked_id desc);

create index if not exists study_together_recipient_page_idx on public.study_together_sessions(recipient_id,status,created_at desc,id desc);

create index if not exists direct_conversations_user_low_page_idx on public.direct_conversations(user_low_id,last_message_at desc,id desc);

create index if not exists direct_conversations_user_high_page_idx on public.direct_conversations(user_high_id,last_message_at desc,id desc);
