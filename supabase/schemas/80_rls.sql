-- Effective RLS, relation permissions, and realtime policies.

revoke all on table private.social_friend_request_events from public;

revoke all on table private.social_friend_request_events from anon;

revoke all on table private.social_friend_request_events from authenticated;

revoke all on table public.friend_requests from anon, authenticated;

revoke all on table public.user_blocks from anon, authenticated;

revoke all on table public.user_reports from anon, authenticated;

revoke all on table public.direct_conversations, public.direct_messages, public.direct_message_attachments, public.reaction_preferences from public, anon, authenticated;

revoke all on table private.social_activity from public, anon, authenticated;

alter table realtime.messages enable row level security;

revoke all on table public.learning_output_friend_shares from anon, authenticated;

revoke all on table public.direct_conversation_participants from anon, authenticated;

revoke all on public.study_together_sessions, public.study_together_participants, public.study_together_attempts, public.social_notifications, public.social_reactions from anon, authenticated;

alter table realtime.messages enable row level security;

create policy study_sessions_select_own on public.study_sessions for select to authenticated using (user_id = auth.uid());

create policy study_sessions_insert_own on public.study_sessions for insert to authenticated with check (user_id = auth.uid());

create policy study_sessions_update_own on public.study_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy study_sessions_delete_own on public.study_sessions for delete to authenticated using (user_id = auth.uid());

create policy study_mistakes_select_own on public.study_mistakes for select to authenticated using (user_id = auth.uid());

create policy study_mistakes_insert_own on public.study_mistakes for insert to authenticated with check (user_id = auth.uid());

create policy study_mistakes_update_own on public.study_mistakes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy study_mistakes_delete_own on public.study_mistakes for delete to authenticated using (user_id = auth.uid());

create policy "Users can view own quota wallet"
  on public.user_quota_wallet for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own quota wallet" on public.user_quota_wallet;

drop policy if exists "Users can update own quota wallet" on public.user_quota_wallet;

create policy "Users can view own quota consumptions"
  on public.quota_consumptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own quota consumptions" on public.quota_consumptions;

create policy "Users can view own coupon redemptions"
  on public.coupon_redemptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.can_view_workspace(id)));

create policy workspaces_insert_owner on public.workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select auth.uid()) is not null);

create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using ((select private.is_workspace_owner(id)))
  with check ((select private.is_workspace_owner(id)));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

create policy documents_select_member on public.documents
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

create policy documents_insert_editor on public.documents
  for insert to authenticated
  with check ((select private.can_edit_workspace(workspace_id)));

create policy documents_update_editor on public.documents
  for update to authenticated
  using ((select private.can_edit_workspace(workspace_id)))
  with check ((select private.can_edit_workspace(workspace_id)));

create policy document_versions_select_member on public.document_versions
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  );

create policy document_versions_insert_editor on public.document_versions
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
    and created_by = (select auth.uid())
  );

create policy document_versions_update_editor on public.document_versions
  for update to authenticated
  using (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  )
  with check (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  );

create policy canonical_versions_select_member on public.canonical_versions
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  );

create policy canonical_versions_insert_editor on public.canonical_versions
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
    and created_by = (select auth.uid())
  );

create policy canonical_versions_update_editor on public.canonical_versions
  for update to authenticated
  using (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  )
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  );

create policy canonical_version_sections_select_member on public.canonical_version_sections
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      )
    ))
  );

create policy canonical_version_sections_insert_editor on public.canonical_version_sections
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      )
    ))
  );

create policy learning_outputs_select_member on public.learning_outputs
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

create policy learning_outputs_insert_editor on public.learning_outputs
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(workspace_id))
    and created_by = (select auth.uid())
  );

create policy learning_outputs_update_editor on public.learning_outputs
  for update to authenticated
  using ((select private.can_edit_workspace(workspace_id)))
  with check ((select private.can_edit_workspace(workspace_id)));

create policy output_source_snapshots_select_member on public.output_source_snapshots
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id)
    ))
  );

create policy output_source_snapshots_insert_editor on public.output_source_snapshots
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id)
    ))
  );

drop policy if exists approved_questions_select_own on public.approved_questions;

create policy approved_questions_select_workspace on public.approved_questions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_view_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_insert_own on public.approved_questions;

create policy approved_questions_insert_workspace on public.approved_questions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_update_own on public.approved_questions;

create policy approved_questions_update_workspace on public.approved_questions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_delete_own on public.approved_questions;

create policy approved_questions_delete_workspace on public.approved_questions
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_select_own on public.approved_flashcards;

create policy approved_flashcards_select_workspace on public.approved_flashcards
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_view_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_insert_own on public.approved_flashcards;

create policy approved_flashcards_insert_workspace on public.approved_flashcards
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_update_own on public.approved_flashcards;

create policy approved_flashcards_update_workspace on public.approved_flashcards
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_delete_own on public.approved_flashcards;

create policy approved_flashcards_delete_workspace on public.approved_flashcards
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

create policy workspace_invitations_select_owner on public.workspace_invitations
  for select to authenticated
  using ((select private.is_workspace_owner(workspace_id)));

create policy workspace_shares_select_owner on public.workspace_shares
  for select to authenticated
  using ((select private.is_workspace_owner(workspace_id)));

create policy "social reaction recipient broadcasts" on realtime.messages for select to authenticated using (
  extension = 'broadcast'
  and realtime.topic() = 'social-reactions:' || auth.uid()::text
);

drop policy if exists "social conversation broadcasts" on realtime.messages;

create policy learning_streaks_select_own
  on public.learning_streaks for select to authenticated
  using (user_id = (select auth.uid()));

create policy "social notification recipient broadcasts" on realtime.messages for select to authenticated using(extension='broadcast' and realtime.topic()='social-notifications:'||auth.uid()::text);

create policy "social request and count broadcasts read"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() in (
      'social-requests:' || auth.uid()::text,
      'social-counts:' || auth.uid()::text
    )
  );

create policy "social request and count broadcasts send"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and realtime.topic() in (
      'social-requests:' || auth.uid()::text,
      'social-counts:' || auth.uid()::text
    )
  );

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
