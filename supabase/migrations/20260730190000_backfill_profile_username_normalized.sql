begin;

update public.profiles
set username_normalized = lower(btrim(username))
where username is not null
  and username_normalized is null;

commit;
