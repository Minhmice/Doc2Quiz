begin;

create extension if not exists pgcrypto;

create table if not exists public.study_together_sessions (
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
create table if not exists public.study_together_participants (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_together_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict, role text not null check (role in ('creator','recipient')),
  status text not null check (status in ('invited','not_started','in_progress','completed','declined')),
  score integer null, accuracy numeric(5,2) null, duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0), completed_at timestamptz null,
  unique(session_id,user_id), unique(session_id,role)
);
create table if not exists public.study_together_attempts (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_together_sessions(id) on delete cascade,
  participant_id uuid not null references public.study_together_participants(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number = 1), status text not null default 'in_progress' check (status in ('in_progress','completed')),
  selected_indices jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_indices) = 'array'), current_question_index integer not null default 0 check (current_question_index >= 0),
  score integer null, question_count integer null, accuracy numeric(5,2) null, duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  started_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz null,
  unique(session_id,participant_id,attempt_number)
);
create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id) on delete cascade, actor_id uuid null references auth.users(id) on delete set null,
  type text not null check (type in ('study_challenge_received','study_challenge_accepted','study_challenge_declined','study_challenge_completed','study_challenge_result_ready','study_challenge_expiring')),
  entity_type text not null default 'study_session' check (entity_type = 'study_session'), entity_id uuid not null, payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null, created_at timestamptz not null default now(), read_at timestamptz null, archived_at timestamptz null,
  unique(recipient_id,dedupe_key)
);
create table if not exists public.social_reactions (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid not null references auth.users(id) on delete cascade,
  reaction_id text not null check (char_length(reaction_id) between 1 and 40), entity_type text not null, entity_id uuid not null, dedupe_key text not null, created_at timestamptz not null default now(),
  check(sender_id <> recipient_id), unique(sender_id,dedupe_key)
);
create index if not exists study_together_sessions_recipient_status_idx on public.study_together_sessions(recipient_id,status,created_at desc);
create index if not exists study_together_sessions_creator_status_idx on public.study_together_sessions(creator_id,status,created_at desc);
create index if not exists social_notifications_unread_idx on public.social_notifications(recipient_id,created_at desc) where read_at is null and archived_at is null;

alter table public.study_together_sessions enable row level security;
alter table public.study_together_participants enable row level security;
alter table public.study_together_attempts enable row level security;
alter table public.social_notifications enable row level security;
alter table public.social_reactions enable row level security;
revoke all on public.study_together_sessions, public.study_together_participants, public.study_together_attempts, public.social_notifications, public.social_reactions from anon, authenticated;

create or replace function private.study_unavailable() returns void language plpgsql set search_path = '' as $$ begin raise exception 'social_unavailable'; end $$;
revoke all on function private.study_unavailable() from public, anon, authenticated;

create or replace function public.create_study_challenge(p_recipient_id uuid,p_output_id uuid,p_mode text default 'score',p_deadline_at timestamptz default null,p_message text default null,p_reveal_policy text default 'after_both_complete') returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid:=auth.uid(); v_output public.learning_outputs%rowtype; v_questions jsonb; v_session uuid; v_snapshot jsonb;
begin
 if v_uid is null or p_recipient_id is null or p_recipient_id=v_uid or p_mode not in ('practice','score') or p_reveal_policy not in ('immediate','after_both_complete','after_deadline') or char_length(coalesce(p_message,''))>500 or (p_deadline_at is not null and p_deadline_at<=now()) then perform private.study_unavailable(); end if;
 if not private.social_are_accepted_friends(v_uid,p_recipient_id) then perform private.study_unavailable(); end if;
 select * into v_output from public.learning_outputs where id=p_output_id for update;
 if v_output.id is null or v_output.created_by<>v_uid or v_output.kind<>'quiz' or v_output.status<>'ready' or v_output.deleted_at is not null then perform private.study_unavailable(); end if;
 select jsonb_agg(jsonb_build_object('id',row_number::text,'prompt',prompt,'choices',choices,'correctIndex',correct_index,'explanation',explanation) order by created_at,id) into v_questions from (select q.*,row_number() over(order by q.created_at,q.id) from public.approved_questions q where q.output_id=p_output_id) q;
 if coalesce(jsonb_array_length(v_questions),0)=0 then perform private.study_unavailable(); end if;
 v_snapshot:=jsonb_build_object('title',v_output.title,'questions',v_questions,'sourceOutputId',v_output.id,'sourceOwnerId',v_uid,'snapshottedAt',now());
 insert into public.study_together_sessions(creator_id,recipient_id,source_output_id,source_owner_id,source_version,snapshot_hash,snapshot,mode,deadline_at,result_reveal_policy) values(v_uid,p_recipient_id,p_output_id,v_uid,coalesce(v_output.updated_at,v_output.created_at)::text,encode(digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),v_snapshot,p_mode,p_deadline_at,p_reveal_policy) returning id into v_session;
 insert into public.study_together_participants(session_id,user_id,role,status) values(v_session,v_uid,'creator','not_started'),(v_session,p_recipient_id,'recipient','invited');
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,payload,dedupe_key) values(p_recipient_id,v_uid,'study_challenge_received',v_session,jsonb_build_object('title',v_output.title,'message',nullif(btrim(p_message),''),'mode',p_mode,'deadlineAt',p_deadline_at),'challenge:'||v_session||':received');
 return jsonb_build_object('sessionId',v_session,'status','pending','recipientId',p_recipient_id);
end $$;

create or replace function private.study_open_attempt(p_session_id uuid,p_role text,p_accept boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_s public.study_together_sessions%rowtype; v_p public.study_together_participants%rowtype; v_attempt uuid; v_existing boolean;
begin
 select * into v_s from public.study_together_sessions where id=p_session_id for update;
 select * into v_p from public.study_together_participants where session_id=p_session_id and user_id=v_uid and role=p_role for update;
 if v_uid is null or v_s.id is null or v_p.id is null or v_s.status in ('expired','cancelled','completed') or (v_s.deadline_at is not null and v_s.deadline_at<=now()) or (p_accept and v_p.status not in ('invited','in_progress')) or (not p_accept and v_p.status not in ('not_started','in_progress')) then perform private.study_unavailable(); end if;
 select id into v_attempt from public.study_together_attempts where session_id=p_session_id and participant_id=v_p.id and attempt_number=1; v_existing:=v_attempt is not null;
 if v_attempt is null then insert into public.study_together_attempts(session_id,participant_id) values(p_session_id,v_p.id) returning id into v_attempt; end if;
 update public.study_together_participants set status='in_progress' where id=v_p.id;
 update public.study_together_sessions set status='active',updated_at=now() where id=p_session_id and status='pending';
 if p_accept then insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(v_s.creator_id,v_uid,'study_challenge_accepted',p_session_id,'challenge:'||p_session_id||':accepted') on conflict(recipient_id,dedupe_key) do nothing; end if;
 return jsonb_build_object('sessionId',p_session_id,'attemptId',v_attempt,'status','in_progress','resumed',v_existing);
end $$;
revoke all on function private.study_open_attempt(uuid,text,boolean) from public,anon,authenticated;
create or replace function public.start_study_challenge_attempt(p_session_id uuid) returns jsonb language sql security definer set search_path=public as $$ select private.study_open_attempt(p_session_id,'creator',false) $$;
create or replace function public.accept_study_challenge(p_session_id uuid) returns jsonb language sql security definer set search_path=public as $$ select private.study_open_attempt(p_session_id,'recipient',true) $$;

create or replace function public.get_study_attempt_practice(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_a public.study_together_attempts%rowtype; v_s public.study_together_sessions%rowtype; v_questions jsonb;
begin
 select a.* into v_a from public.study_together_attempts a join public.study_together_participants p on p.id=a.participant_id where a.id=p_attempt_id and p.user_id=v_uid;
 select * into v_s from public.study_together_sessions where id=v_a.session_id;
 if v_a.id is null or v_s.status='cancelled' then perform private.study_unavailable(); end if;
 select jsonb_agg((q - 'correctIndex' - 'explanation') order by ord) into v_questions from jsonb_array_elements(v_s.snapshot->'questions') with ordinality x(q,ord);
 return jsonb_build_object('sessionId',v_s.id,'attemptId',v_a.id,'title',v_s.snapshot->>'title','mode',v_s.mode,'questions',v_questions,'selectedIndices',v_a.selected_indices);
end $$;

create or replace function public.complete_study_attempt(p_attempt_id uuid,p_selected_indices jsonb,p_duration_seconds integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_a public.study_together_attempts%rowtype; v_p public.study_together_participants%rowtype; v_s public.study_together_sessions%rowtype; v_count int; v_score int; v_visible boolean; v_all_done boolean;
begin
 select * into v_a from public.study_together_attempts where id=p_attempt_id for update;
 select * into v_p from public.study_together_participants where id=v_a.participant_id and user_id=v_uid for update;
 select * into v_s from public.study_together_sessions where id=v_a.session_id for update;
 if v_a.id is null or v_p.id is null or v_s.status='cancelled' or jsonb_typeof(p_selected_indices)<>'array' or p_duration_seconds<0 then perform private.study_unavailable(); end if;
 if v_a.status='completed' then return jsonb_build_object('attemptId',v_a.id,'status','completed','score',v_a.score,'questionCount',v_a.question_count,'accuracy',v_a.accuracy,'durationSeconds',v_a.duration_seconds,'resultsVisible',(v_s.result_reveal_policy='immediate' or v_s.status='completed' or (v_s.result_reveal_policy='after_deadline' and v_s.deadline_at<=now()))); end if;
 v_count:=jsonb_array_length(v_s.snapshot->'questions'); if jsonb_array_length(p_selected_indices)<>v_count then perform private.study_unavailable(); end if;
 select count(*) into v_score from jsonb_array_elements(v_s.snapshot->'questions') with ordinality q(question,ord) where (p_selected_indices->>(ord-1))::int=(question->>'correctIndex')::int;
 update public.study_together_attempts set status='completed',selected_indices=p_selected_indices,score=v_score,question_count=v_count,accuracy=round(v_score*100.0/v_count,2),duration_seconds=p_duration_seconds,completed_at=now(),updated_at=now() where id=v_a.id;
 update public.study_together_participants set status='completed',score=v_score,accuracy=round(v_score*100.0/v_count,2),duration_seconds=p_duration_seconds,completed_at=now() where id=v_p.id;
 select bool_and(status='completed') into v_all_done from public.study_together_participants where session_id=v_s.id;
 if v_all_done then update public.study_together_sessions set status='completed',completed_at=now(),updated_at=now() where id=v_s.id; end if;
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(case when v_uid=v_s.creator_id then v_s.recipient_id else v_s.creator_id end,v_uid,'study_challenge_completed',v_s.id,'challenge:'||v_s.id||':completed:'||v_uid) on conflict(recipient_id,dedupe_key) do nothing;
 if v_all_done then insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(v_s.creator_id,null,'study_challenge_result_ready',v_s.id,'challenge:'||v_s.id||':result:'||v_s.creator_id),(v_s.recipient_id,null,'study_challenge_result_ready',v_s.id,'challenge:'||v_s.id||':result:'||v_s.recipient_id) on conflict(recipient_id,dedupe_key) do nothing; end if;
 v_visible:=v_s.result_reveal_policy='immediate' or v_all_done or (v_s.result_reveal_policy='after_deadline' and v_s.deadline_at<=now());
 return jsonb_build_object('attemptId',v_a.id,'status','completed','score',v_score,'questionCount',v_count,'accuracy',round(v_score*100.0/v_count,2),'durationSeconds',p_duration_seconds,'resultsVisible',v_visible);
end $$;

create or replace function public.list_study_challenges(p_limit integer default 20,p_before timestamptz default null) returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('challenges',coalesce(jsonb_agg(jsonb_build_object('sessionId',s.id,'status',s.status,'recipientId',s.recipient_id,'creatorId',s.creator_id,'title',s.snapshot->>'title','mode',s.mode,'deadlineAt',s.deadline_at,'createdAt',s.created_at) order by s.created_at desc),'[]'::jsonb)) from (select * from public.study_together_sessions where auth.uid() in (creator_id,recipient_id) and (p_before is null or created_at<p_before) order by created_at desc limit least(greatest(p_limit,1),50)) s $$;
create or replace function public.get_study_challenge(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare s public.study_together_sessions%rowtype; begin select * into s from public.study_together_sessions where id=p_session_id and auth.uid() in (creator_id,recipient_id); if s.id is null then perform private.study_unavailable(); end if; return jsonb_build_object('sessionId',s.id,'status',s.status,'title',s.snapshot->>'title','mode',s.mode,'deadlineAt',s.deadline_at,'resultsVisible',s.result_reveal_policy='immediate' or s.status='completed' or (s.result_reveal_policy='after_deadline' and s.deadline_at<=now())); end $$;
create or replace function public.decline_study_challenge(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare s public.study_together_sessions%rowtype; begin select * into s from public.study_together_sessions where id=p_session_id for update; if s.id is null or s.recipient_id<>auth.uid() or s.status<>'pending' then perform private.study_unavailable(); end if; update public.study_together_participants set status='declined' where session_id=s.id and role='recipient'; update public.study_together_sessions set status='cancelled',updated_at=now() where id=s.id; insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(s.creator_id,auth.uid(),'study_challenge_declined',s.id,'challenge:'||s.id||':declined') on conflict do nothing; return jsonb_build_object('sessionId',s.id,'status','cancelled'); end $$;
create or replace function public.save_study_attempt_progress(p_attempt_id uuid,p_selected_indices jsonb,p_current_question_index integer) returns jsonb language plpgsql security definer set search_path=public as $$ declare a public.study_together_attempts%rowtype; begin select a.* into a from public.study_together_attempts a join public.study_together_participants p on p.id=a.participant_id where a.id=p_attempt_id and p.user_id=auth.uid() for update; if a.id is null or a.status<>'in_progress' or jsonb_typeof(p_selected_indices)<>'array' or jsonb_array_length(p_selected_indices)>500 or p_current_question_index<0 or p_current_question_index>499 then perform private.study_unavailable(); end if; update public.study_together_attempts set selected_indices=p_selected_indices,current_question_index=p_current_question_index,updated_at=now() where id=a.id; return jsonb_build_object('attemptId',a.id,'saved',true); end $$;

create or replace function public.list_social_notifications(p_limit integer default 20,p_before timestamptz default null) returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('notifications',coalesce(jsonb_agg(jsonb_build_object('id',n.id,'type',n.type,'recipientId',n.recipient_id,'actorId',n.actor_id,'entityId',n.entity_id,'payload',n.payload,'createdAt',n.created_at,'readAt',n.read_at,'archivedAt',n.archived_at) order by n.created_at desc),'[]'::jsonb)) from (select * from public.social_notifications where recipient_id=auth.uid() and archived_at is null and (p_before is null or created_at<p_before) order by created_at desc limit least(greatest(p_limit,1),50)) n $$;
create or replace function public.mark_social_notification_read(p_notification_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ begin update public.social_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid() and archived_at is null; if not found then perform private.study_unavailable(); end if; return jsonb_build_object('ok',true); end $$;
create or replace function public.mark_all_social_notifications_read() returns jsonb language sql security definer set search_path=public as $$ with changed as (update public.social_notifications set read_at=coalesce(read_at,now()) where recipient_id=auth.uid() and archived_at is null and read_at is null returning 1) select jsonb_build_object('count',count(*)) from changed $$;
create or replace function public.archive_study_challenge_notification(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ begin update public.social_notifications set archived_at=coalesce(archived_at,now()) where recipient_id=auth.uid() and entity_id=p_session_id and type='study_challenge_received'; if not found then perform private.study_unavailable(); end if; return jsonb_build_object('ok',true); end $$;
create or replace function public.get_social_notification_unread_count() returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('count',count(*)) from public.social_notifications where recipient_id=auth.uid() and read_at is null and archived_at is null $$;

create or replace function public.sweep_study_challenge_reminders() returns integer language plpgsql security definer set search_path=public as $$ declare v_count int; begin
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) select recipient_id,creator_id,'study_challenge_expiring',id,'challenge:'||id||':expiring' from public.study_together_sessions where status in ('pending','active') and deadline_at>now() and deadline_at<=now()+interval '24 hours' on conflict(recipient_id,dedupe_key) do nothing; get diagnostics v_count=row_count; return v_count; end $$;

create or replace function public.broadcast_social_notification() returns trigger language plpgsql security definer set search_path=public as $$ begin perform realtime.send(jsonb_build_object('notificationId',new.id),'notification','social-notifications:'||new.recipient_id::text,true); return new; exception when others then return new; end $$;
drop trigger if exists social_notifications_broadcast on public.social_notifications;
create trigger social_notifications_broadcast after insert on public.social_notifications for each row execute function public.broadcast_social_notification();

drop policy if exists "social notification recipient broadcasts" on realtime.messages;
create policy "social notification recipient broadcasts" on realtime.messages for select to authenticated using(extension='broadcast' and realtime.topic()='social-notifications:'||auth.uid()::text);

-- Existing social actions gain distinct challenge effects while preserving their prior behavior.
create or replace function public.remove_friend(p_other_user_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare v_uid uuid:=auth.uid(); begin
 if v_uid is null or p_other_user_id is null then perform private.study_unavailable(); end if;
 update public.friend_requests set status='cancelled' where status='accepted' and ((sender_id=v_uid and recipient_id=p_other_user_id) or (sender_id=p_other_user_id and recipient_id=v_uid));
 if not found then perform private.study_unavailable(); end if;
 update public.study_together_sessions set status='cancelled',updated_at=now() where status='pending' and ((creator_id=v_uid and recipient_id=p_other_user_id) or (creator_id=p_other_user_id and recipient_id=v_uid));
 return jsonb_build_object('ok',true);
end $$;

create or replace function private.cancel_study_sessions_for_block(p_user_a uuid,p_user_b uuid) returns void language sql security definer set search_path=public as $$ update public.study_together_sessions set status='cancelled',updated_at=now() where status in ('pending','active') and ((creator_id=p_user_a and recipient_id=p_user_b) or (creator_id=p_user_b and recipient_id=p_user_a)) $$;
revoke all on function private.cancel_study_sessions_for_block(uuid,uuid) from public,anon,authenticated;

create or replace function public.block_user(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare v_uid uuid:=auth.uid(); begin
 if v_uid is null or p_user_id is null or p_user_id=v_uid then raise exception 'request_unavailable'; end if;
 insert into public.user_blocks(blocker_id,blocked_id) values(v_uid,p_user_id) on conflict do nothing;
 update public.friend_requests set status='cancelled',responded_at=now() where status in ('pending','accepted') and ((sender_id=v_uid and recipient_id=p_user_id) or (sender_id=p_user_id and recipient_id=v_uid));
 perform private.cancel_study_sessions_for_block(v_uid,p_user_id);
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.create_study_challenge(uuid,uuid,text,timestamptz,text,text),public.start_study_challenge_attempt(uuid),public.accept_study_challenge(uuid),public.get_study_attempt_practice(uuid),public.complete_study_attempt(uuid,jsonb,integer),public.list_study_challenges(integer,timestamptz),public.get_study_challenge(uuid),public.decline_study_challenge(uuid),public.save_study_attempt_progress(uuid,jsonb,integer),public.list_social_notifications(integer,timestamptz),public.mark_social_notification_read(uuid),public.mark_all_social_notifications_read(),public.archive_study_challenge_notification(uuid),public.get_social_notification_unread_count(),public.sweep_study_challenge_reminders(),public.remove_friend(uuid) from public,anon;
grant execute on function public.create_study_challenge(uuid,uuid,text,timestamptz,text,text),public.start_study_challenge_attempt(uuid),public.accept_study_challenge(uuid),public.get_study_attempt_practice(uuid),public.complete_study_attempt(uuid,jsonb,integer),public.list_study_challenges(integer,timestamptz),public.get_study_challenge(uuid),public.decline_study_challenge(uuid),public.save_study_attempt_progress(uuid,jsonb,integer),public.list_social_notifications(integer,timestamptz),public.mark_social_notification_read(uuid),public.mark_all_social_notifications_read(),public.archive_study_challenge_notification(uuid),public.get_social_notification_unread_count(),public.sweep_study_challenge_reminders(),public.remove_friend(uuid) to authenticated;

commit;
