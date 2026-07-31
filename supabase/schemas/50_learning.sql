-- Learning content, sessions, streaks, quota, coupons, and imports.

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  subtitle text null,
  pipeline_stage text not null default 'input',
  content_kind text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sets_pipeline_stage_check check (
    pipeline_stage in ('input', 'raw', 'canonical', 'mode_selected', 'quiz', 'flashcards')
  ),
  constraint study_sets_content_kind_check check (
    content_kind is null or content_kind in ('quiz', 'flashcards')
  ),
  constraint study_sets_id_user_id_unique unique (id, user_id)
);

create table if not exists public.approved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  prompt text not null,
  choices text[] not null,
  correct_index smallint not null,
  explanation text null,
  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_questions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint approved_questions_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint approved_questions_choices_len_check check (array_length(choices, 1) = 4),
  constraint approved_questions_correct_index_check check (correct_index between 0 and 3)
);

create table if not exists public.approved_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  front text not null,
  back text not null,
  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_flashcards_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint approved_flashcards_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade
);

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  completed_at timestamptz not null default now(),
  total_questions integer not null,
  correct_count integer not null,
  constraint quiz_sessions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint quiz_sessions_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade
);

create table if not exists public.study_wrong_history (
  user_id uuid not null,
  study_set_id uuid not null,
  question_ids uuid[] not null,
  updated_at timestamptz not null default now(),
  constraint study_wrong_history_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_wrong_history_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint study_wrong_history_user_id_study_set_id_pk primary key (user_id, study_set_id)
);

alter table public.study_sets enable row level security;

alter table public.approved_questions enable row level security;

alter table public.approved_flashcards enable row level security;

alter table public.quiz_sessions enable row level security;

alter table public.study_wrong_history enable row level security;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  mode text not null,
  practice text not null default 'standard',
  item_ids uuid[] not null,
  current_item_id uuid null,
  next_item_id uuid null,
  interaction_state jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint study_sessions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sessions_study_set_fk foreign key (study_set_id, user_id) references public.study_sets (id, user_id) on delete cascade,
  constraint study_sessions_mode_check check (mode in ('quiz', 'flashcard')),
  constraint study_sessions_practice_check check (practice in ('standard', 'mistakes')),
  constraint study_sessions_revision_check check (revision >= 0),
  constraint study_sessions_items_bound_check check (cardinality(item_ids) between 1 and 2000),
  constraint study_sessions_interaction_object_check check (jsonb_typeof(interaction_state) = 'object')
);

create table if not exists public.study_mistakes (
  user_id uuid not null,
  study_set_id uuid not null,
  item_id uuid not null,
  mode text not null,
  unresolved boolean not null default true,
  mistake_count integer not null default 1,
  first_mistake_at timestamptz not null default now(),
  last_mistake_at timestamptz not null default now(),
  last_practiced_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint study_mistakes_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_mistakes_study_set_fk foreign key (study_set_id, user_id) references public.study_sets (id, user_id) on delete cascade,
  constraint study_mistakes_mode_check check (mode in ('quiz', 'flashcard')),
  constraint study_mistakes_count_check check (mistake_count > 0),
  constraint study_mistakes_resolution_check check ((unresolved and resolved_at is null) or not unresolved),
  constraint study_mistakes_owner_set_mode_item_unique unique (user_id, study_set_id, mode, item_id)
);

alter table public.study_sessions enable row level security;

alter table public.study_mistakes enable row level security;

alter table public.study_sets
  drop constraint if exists study_sets_pipeline_stage_check;

alter table public.study_sets
  add constraint study_sets_pipeline_stage_check check (
    pipeline_stage in (
      'input',
      'raw',
      'canonical',
      'mode_selected',
      'quiz',
      'flashcards'
    )
  );

alter table public.study_sets
  drop constraint if exists study_sets_pipeline_stage_check;

alter table public.study_sets
  alter column pipeline_stage set default 'input';

alter table public.study_sets
  add constraint study_sets_pipeline_stage_check check (
    pipeline_stage in (
      'input',
      'raw',
      'canonical',
      'mode_selected',
      'quiz',
      'flashcards'
    )
  ) not valid;

alter table public.study_sets
  validate constraint study_sets_pipeline_stage_check;

create table public.user_quota_wallet (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  updated_at timestamptz not null default now()
);

create table public.quota_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null references public.study_sets(id) on delete cascade,
  content_kind text not null check (content_kind in ('quiz', 'flashcards')),
  consumed_at timestamptz not null default now(),
  used_bonus boolean not null default false,
  unique (user_id, study_set_id)
);

create table public.coupon_codes (
  code text primary key,
  bonus_credits integer not null check (bonus_credits > 0),
  max_redemptions integer check (max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.coupon_codes(code),
  redeemed_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.user_quota_wallet enable row level security;

alter table public.quota_consumptions enable row level security;

alter table public.coupon_codes enable row level security;

alter table public.coupon_redemptions enable row level security;

alter table public.quota_consumptions
  add column if not exists state text not null default 'committed',
  add column if not exists reservation_token uuid,
  add column if not exists reserved_at timestamptz,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists committed_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists release_reason text;

alter table public.quota_consumptions
  drop constraint if exists quota_consumptions_state_check,
  add constraint quota_consumptions_state_check check (state in ('reserved', 'committed', 'released'));

create table if not exists public.learning_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  legacy_study_set_id uuid not null unique references public.study_sets (id) on delete restrict,
  legacy_parent_study_set_id uuid not null references public.study_sets (id) on delete restrict,
  kind text not null,
  title text not null,
  status text not null default 'ready',
  generation_provenance jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint learning_outputs_kind_check check (kind in ('quiz', 'flashcards')),
  constraint learning_outputs_status_check check (
    status in ('pending', 'ready', 'failed')
  ),
  constraint learning_outputs_bridge_ne_parent check (
    legacy_study_set_id <> legacy_parent_study_set_id
  )
);

alter table public.approved_questions
  add column if not exists output_id uuid null
    references public.learning_outputs (id) on delete set null;

alter table public.approved_flashcards
  add column if not exists output_id uuid null
    references public.learning_outputs (id) on delete set null;

alter table public.learning_outputs enable row level security;

alter table public.learning_outputs
  alter column legacy_parent_study_set_id drop not null;

alter table public.learning_outputs
  drop constraint if exists learning_outputs_bridge_ne_parent;

alter table public.learning_outputs
  add constraint learning_outputs_bridge_ne_parent check (
    legacy_parent_study_set_id is null
    or legacy_study_set_id <> legacy_parent_study_set_id
  );

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

alter table public.anonymous_quiz_attempt_imports enable row level security;

create table if not exists public.learning_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  last_quiz_date date,
  lost_streak integer not null default 0 check (lost_streak >= 0),
  lost_at timestamptz,
  recovery_started_at timestamptz,
  recovery_quiz_count integer not null default 0 check (recovery_quiz_count between 0 and 2),
  recovery_month date,
  recoveries_this_month integer not null default 0 check (recoveries_this_month between 0 and 2),
  updated_at timestamptz not null default now()
);

alter table public.learning_streaks enable row level security;

create index if not exists study_sessions_owner_unfinished_updated_idx
  on public.study_sessions (user_id, updated_at desc)
  where completed_at is null;

create index if not exists study_sessions_owner_set_mode_practice_idx
  on public.study_sessions (user_id, study_set_id, mode, practice, updated_at desc);

create index if not exists study_mistakes_owner_unresolved_mode_order_idx
  on public.study_mistakes (user_id, mode, mistake_count desc, last_practiced_at desc)
  where unresolved;

create index if not exists study_mistakes_owner_unresolved_set_idx
  on public.study_mistakes (user_id, study_set_id, mode)
  where unresolved;

create index quota_consumptions_user_consumed_at_idx
  on public.quota_consumptions (user_id, consumed_at);

create index quota_consumptions_user_study_set_idx
  on public.quota_consumptions (user_id, study_set_id);

create unique index if not exists quota_consumptions_reservation_token_unique
  on public.quota_consumptions (reservation_token)
  where reservation_token is not null;

create index if not exists quota_consumptions_user_state_consumed_at_idx
  on public.quota_consumptions (user_id, state, consumed_at);

create index if not exists quota_consumptions_active_expiry_idx
  on public.quota_consumptions (reservation_expires_at)
  where state = 'reserved';

create unique index if not exists learning_outputs_parent_kind_active_unique
  on public.learning_outputs (legacy_parent_study_set_id, kind)
  where deleted_at is null;

create index if not exists learning_outputs_workspace_active_idx
  on public.learning_outputs (workspace_id, updated_at desc)
  where deleted_at is null;

create index if not exists learning_outputs_parent_idx
  on public.learning_outputs (legacy_parent_study_set_id);

create index if not exists approved_questions_output_id_idx
  on public.approved_questions (output_id)
  where output_id is not null;

create index if not exists approved_flashcards_output_id_idx
  on public.approved_flashcards (output_id)
  where output_id is not null;

create index if not exists anonymous_quiz_attempt_imports_user_imported_idx
  on public.anonymous_quiz_attempt_imports (user_id, imported_at desc);
