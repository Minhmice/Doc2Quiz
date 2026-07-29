create or replace function public.quota_week_start_ict()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('week', timezone('Asia/Ho_Chi_Minh', now()))::date)::timestamp
         at time zone 'Asia/Ho_Chi_Minh';
$$;

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

create index quota_consumptions_user_consumed_at_idx
  on public.quota_consumptions (user_id, consumed_at);

create index quota_consumptions_user_study_set_idx
  on public.quota_consumptions (user_id, study_set_id);

alter table public.user_quota_wallet enable row level security;
alter table public.quota_consumptions enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy "Users can view own quota wallet"
  on public.user_quota_wallet for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view own quota consumptions"
  on public.quota_consumptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own quota consumptions"
  on public.quota_consumptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can view own coupon redemptions"
  on public.coupon_redemptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
