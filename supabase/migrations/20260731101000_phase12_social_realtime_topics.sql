begin;

alter table realtime.messages enable row level security;

-- Private user-scoped invalidation topics. Both receive and send are bound to auth.uid().
drop policy if exists "social request and count broadcasts read" on realtime.messages;
create policy "social request and count broadcasts read"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() in (
      'social-requests:' || auth.uid()::text,
      'social-counts:' || auth.uid()::text
    )
  );

drop policy if exists "social request and count broadcasts send" on realtime.messages;
create policy "social request and count broadcasts send"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and realtime.topic() in (
      'social-requests:' || auth.uid()::text,
      'social-counts:' || auth.uid()::text
    )
  );

-- Replace earlier read-only conversation policy additively; membership remains authority.
drop policy if exists "social conversation broadcasts" on realtime.messages;
drop policy if exists "social conversation broadcasts read" on realtime.messages;
create policy "social conversation broadcasts read"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and exists (
      select 1
      from public.direct_conversations c
      where realtime.topic() = 'social-messages:' || c.id::text
        and auth.uid() in (c.user_low_id, c.user_high_id)
        and private.social_are_accepted_friends(c.user_low_id, c.user_high_id)
    )
  );

drop policy if exists "social conversation broadcasts send" on realtime.messages;
create policy "social conversation broadcasts send"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and exists (
      select 1
      from public.direct_conversations c
      where realtime.topic() = 'social-messages:' || c.id::text
        and auth.uid() in (c.user_low_id, c.user_high_id)
        and private.social_are_accepted_friends(c.user_low_id, c.user_high_id)
    )
  );

commit;
