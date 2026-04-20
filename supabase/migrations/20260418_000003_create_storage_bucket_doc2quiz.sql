begin;

insert into storage.buckets (id, name, public)
values ('doc2quiz', 'doc2quiz', false)
on conflict (id) do nothing;

commit;
