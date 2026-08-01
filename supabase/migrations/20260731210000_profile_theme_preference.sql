begin;

alter table public.profiles
  add column if not exists theme_preference text not null default 'system';

update public.profiles
set theme_preference = 'system'
where theme_preference is null
   or theme_preference not in ('system', 'vscode-dark', 'vscode-light', 'monokai', 'high-contrast');

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('system', 'vscode-dark', 'vscode-light', 'monokai', 'high-contrast'));

commit;
