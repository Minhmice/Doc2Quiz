-- Profiles and onboarding.

alter table public.profiles
  add column if not exists username text null,
  add column if not exists username_normalized text null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    username is null
    or (
      char_length(username) between 3 and 30
      and username_normalized = lower(btrim(username))
      and username_normalized ~ '^[a-z0-9_]{3,30}$'
    )
  );

alter table public.profiles
  add column if not exists onboarding_version integer null,
  add column if not exists onboarding_completed_at timestamptz null,
  add column if not exists coach_mode text null,
  add column if not exists study_identity text null,
  add column if not exists commitment text null,
  add column if not exists preferred_study_time text null;

alter table public.profiles
  drop constraint if exists profiles_coach_mode_check,
  drop constraint if exists profiles_study_identity_check,
  drop constraint if exists profiles_commitment_check,
  drop constraint if exists profiles_preferred_study_time_check;

alter table public.profiles
  add constraint profiles_coach_mode_check check (coach_mode is null or coach_mode in ('aggressive', 'balanced', 'chill')),
  add constraint profiles_study_identity_check check (study_identity is null or study_identity in ('exams', 'university', 'certifications', 'work_skills', 'personal_learning', 'unknown')),
  add constraint profiles_commitment_check check (commitment is null or commitment in ('casual', 'serious', 'locked_in')),
  add constraint profiles_preferred_study_time_check check (preferred_study_time is null or preferred_study_time in ('morning', 'afternoon', 'evening', 'flexible'));

alter table public.profiles
  add column if not exists theme_preference text not null default 'system';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('system', 'vscode-dark', 'vscode-light', 'monokai', 'high-contrast'));

create unique index if not exists profiles_username_normalized_unique
  on public.profiles (username_normalized)
  where username_normalized is not null;
