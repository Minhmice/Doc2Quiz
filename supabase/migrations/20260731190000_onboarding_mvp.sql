begin;

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

update public.profiles
set onboarding_version = 1,
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null
  and (display_name is not null or bio is not null or username is not null);

commit;
