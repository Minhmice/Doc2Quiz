---
phase: quick-self-hosted-supabase-architecture
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/schemas/00_extensions.sql
  - supabase/schemas/10_types.sql
  - supabase/schemas/20_profiles.sql
  - supabase/schemas/30_workspaces.sql
  - supabase/schemas/40_documents.sql
  - supabase/schemas/50_learning.sql
  - supabase/schemas/60_social.sql
  - supabase/schemas/70_functions.sql
  - supabase/schemas/80_rls.sql
  - supabase/schemas/90_storage.sql
  - supabase/tests/database/00_schema_contract.sql
  - supabase/tests/database/10_rls_isolation.sql
  - supabase/tests/database/20_workspace_access.sql
  - supabase/tests/database/30_profile_friend_access.sql
  - supabase/tests/database/40_rpc_permissions.sql
  - supabase/tests/database/50_onboarding.sql
  - supabase/tests/database/60_messages_read_state.sql
  - supabase/tests/database/70_anonymous_quiz_attempts.sql
  - supabase/tests/database/80_storage_access.sql
  - supabase/seed.sql
autonomous: true
requirements:
  - QUICK-DB-AUDIT
  - QUICK-DB-CANONICAL
  - QUICK-DB-SECURITY
  - QUICK-DB-REGRESSION
must_haves:
  truths:
    - "Fresh self-hosted PostgreSQL/Supabase database built from canonical schema exposes same production tables, columns, constraints, indexes, views, functions, triggers, grants, RLS, realtime policies, bucket, and storage policies as immutable migration history."
    - "Existing database upgraded through immutable migrations remains valid; no applied or corrective migration is edited, removed, or squashed."
    - "anon, authenticated, service_role, owner, editor, viewer, member, friend, non-friend, blocked user, and unauthenticated behavior remains unchanged."
    - "Every SECURITY DEFINER function has fixed restricted search_path and only intended roles can execute public RPCs."
    - "Database tests prove required access and denial paths without Supabase CLI."
  artifacts:
    - path: "supabase/schemas/00_extensions.sql"
      provides: "Schemas and extension bootstrap"
    - path: "supabase/schemas/20_profiles.sql"
      provides: "Profile and onboarding canonical DDL"
    - path: "supabase/schemas/30_workspaces.sql"
      provides: "Workspace membership canonical DDL"
    - path: "supabase/schemas/40_documents.sql"
      provides: "Legacy and versioned document canonical DDL"
    - path: "supabase/schemas/50_learning.sql"
      provides: "Quiz, flashcard, quota, streak, attempt canonical DDL"
    - path: "supabase/schemas/60_social.sql"
      provides: "Friend, messaging, challenge, notification canonical DDL"
    - path: "supabase/schemas/70_functions.sql"
      provides: "Final function and trigger definitions plus execute grants"
    - path: "supabase/schemas/80_rls.sql"
      provides: "Final table and realtime RLS policy state"
    - path: "supabase/schemas/90_storage.sql"
      provides: "Private doc2quiz bucket and final object policies"
    - path: "supabase/tests/database/00_schema_contract.sql"
      provides: "Catalog parity and security invariant assertions"
    - path: "supabase/seed.sql"
      provides: "Repeatable non-production seed data"
  key_links:
    - from: "supabase/schemas/70_functions.sql"
      to: "supabase/schemas/20_profiles.sql through 60_social.sql"
      via: "schema-qualified function bodies, trigger targets, and exact signatures"
    - from: "supabase/schemas/80_rls.sql"
      to: "supabase/schemas/70_functions.sql"
      via: "private authorization helpers used by policies"
    - from: "supabase/schemas/90_storage.sql"
      to: "supabase/schemas/70_functions.sql"
      via: "workspace/avatar path helpers"
    - from: "src/**/*.{ts,tsx}"
      to: "public tables and RPCs"
      via: "Supabase .from(), .rpc(), and storage.from() callers"
---

<objective>
Audit immutable migration history and every application database caller, then create canonical self-hosted PostgreSQL/Supabase schema files and regression tests without changing production behavior or data.

Purpose: Make final database architecture reviewable and reproducible while preserving migrations as historical upgrade ledger.
Output: Evidence-backed canonical schema, direct-psql database tests, repeatable seed, and zero migration edits.
</objective>

<execution_context>
@supabase/migrations/
@supabase/tests/
@src/
</execution_context>

## Guardrails

- Treat every file under `supabase/migrations/**` as immutable, including corrective migrations. Do not edit, rename, delete, reorder, squash, or generate a replacement migration.
- Canonical files describe final state for fresh self-hosted installs; they do not replace migration execution for existing installs.
- Do not use Supabase CLI. Use `psql` against disposable self-hosted PostgreSQL/Supabase databases supplied by executor environment. Never point destructive test setup at production.
- No destructive DDL or data rewrite. No object rename unless catalog inventory proves need and every SQL/application caller changes atomically; default is no rename.
- Never disable RLS. Preserve role semantics and exact RPC response/error contracts.
- Use explicit schema qualification for objects and function-body references. Every `SECURITY DEFINER` function gets restricted `SET search_path` (prefer `''`; include only required trusted schemas), schema-qualified calls, and explicit revokes/grants by exact signature.
- Use repeatable DDL where PostgreSQL safely supports it. For policies/triggers lacking `CREATE IF NOT EXISTS`, use deterministic `DROP ... IF EXISTS` only in fresh canonical composition, never against production from this task.
- Prove redundancy through final-definition and dependency evidence before excluding superseded logic from canonical files. Historical duplicates remain in migrations.
- Do not touch `.next/**`, `.env.example`, or unrelated dirty files. Before and after each task inspect `git status --short`; stage only listed task files. Do not commit unless parent workflow explicitly requests it.

## 1. Existing object inventory

Evidence baseline: 34 ordered migrations, from `20260725120000_v21_baseline.sql` through `20260731190000_onboarding_mvp.sql`.

### Schemas and extensions
- `public`, `private`, `extensions`; `pgcrypto` is requested by baseline and workspace/social migrations (`20260725120000_v21_baseline.sql:11`, `20260730150000_workspace_foundation.sql:7-22`, `20260731100000_phase12_study_together_foundation.sql:3`). Canonical placement must match actual self-hosted image availability and use qualified `extensions.digest`/helper calls where applicable.
- Supabase-managed dependencies: `auth.users`, `storage.buckets`, `storage.objects`, `realtime.messages`. Canonical SQL must reference, not recreate, these platform-owned objects.

### Profiles
- `public.profiles` predates repository migration baseline but is consumed by app and later altered. Added final fields include `username`, `username_normalized` (`20260730140400_phase10_social_safety.sql:8-27`) and onboarding fields (`20260731190000_onboarding_mvp.sql:3-21`). Callers: `src/app/api/profile/route.ts`, `src/lib/supabase/auth-guard.ts`, `src/app/(app)/layout.tsx`, friend profile/list RPCs.
- Profile username trigger/function: `profiles_sync_username_normalized` / `public.sync_profile_username_normalized()` (`20260730140400_phase10_social_safety.sql:29-49`). Profile base columns, policies, grants, and auth-user provisioning trigger must be discovered from repository/config or declared as an explicit prerequisite if truly absent; do not invent their shape.

### Legacy documents and learning
- Baseline tables: `study_sets`, `canonical_documents`, `canonical_sections`, `approved_questions`, `approved_flashcards`, `quiz_sessions`, `study_wrong_history` (`20260725120000_v21_baseline.sql:27-174`), all RLS-enabled (`:180-186`).
- Later learning tables: resumable `study_sessions`/`study_mistakes` (`20260726150000_resumable_study_sessions.sql`), quota wallet/consumptions/coupons/redemptions (`20260730120000_quota_coupons.sql:10-48`), quota reservations/final RPC state (`20260730140000_atomic_generation_quota_reservations.sql`), anonymous imports (`20260730150500_phase10_anonymous_quiz_attempts.sql:10-39`), streaks (`20260730180000_learning_streaks.sql:3-20`).
- Atomic RPCs include `replace_quiz_questions`, `replace_canonical_content`, quota reserve/commit/release/availability, streak record/get/recovery, mistake record/resolve, anonymous attempt import. Callers exist in `src/lib/pipeline/quizGenerate.ts`, `src/lib/pipeline/canonicalize.ts`, `src/lib/server/quota/generationQuotaReservation.ts`, `src/lib/client/activityTracking.ts`, and `src/lib/server/quizAttempts/importAnonymousQuizAttempts.ts`.

### Workspaces and versioned content
- Tables: `workspaces`, `workspace_members`, `documents`, `document_versions`, `canonical_versions`, `canonical_version_sections`, `learning_outputs`, `output_source_snapshots` (`20260730150000_workspace_foundation.sql:31-225`). Legacy `canonical_sections` intentionally coexists with versioned `canonical_version_sections` (`:132`).
- Roles are `owner|editor|viewer`, not generic member enums (`20260730150000_workspace_foundation.sql:50-57`). Access helpers are final `private.workspace_role`, `can_view_workspace`, `can_edit_workspace`, `is_workspace_owner`, plus compatibility `can_workspace` (`20260730150200_phase10_workspace_authorization.sql:10-122`).
- Workspace callers span `src/lib/workspaces/{canonicalReader,workspaceSummary,legacyBridge,documentVersions,createWorkspaceIngest}.ts`, pipeline generators/canonical persistence, and `src/app/api/workspaces/**`.

### Social, messaging, realtime
- Tables: `friend_requests`, `user_blocks`, `user_reports`, private request events (`20260730140400_phase10_social_safety.sql:55-119`); `direct_conversations`, `direct_messages`, private `social_activity`, `reaction_preferences` (`20260730170000_friends_messages_presence.sql:3-46`); `direct_conversation_participants` (`20260731013000_direct_message_read_state.sql:3-14`); friend quiz shares; study-together sessions/participants/attempts, notifications, reactions (`20260731100000_phase12_study_together_foundation.sql:5-59`).
- Public RPCs cover username, requests, blocks/reports, friends/profile/shared quizzes, conversations/messages/read state, reactions/activity, study challenges, notifications, and bounded lists. Callers are concentrated in `src/lib/server/friends/**` and `src/app/api/friends/**`.
- `realtime.messages` final policies include user request/count topics and conversation read/send topics (`20260731101000_phase12_social_realtime_topics.sql:6-55`), plus notification/reaction topics from foundation migrations.

### Storage
- Private bucket `doc2quiz` created in baseline (`20260725120000_v21_baseline.sql:322-324`). Legacy owner policies, workspace-path policies (`20260730150200_phase10_workspace_authorization.sql:507-545`), friend avatar read (`20260731010000_friend_profile_avatar_access.sql:19-27`), and corrected own-avatar path policies (`20260731180000_fix_profile_avatar_storage_rls.sql:19-45`) form additive final behavior.
- App paths: profile upload/signing in `src/components/profile/ProfilePageClient.tsx` and `src/app/api/profile/route.ts`; workspace object paths are authorized by `private.storage_object_workspace_id`.

## 2. Dependency map

1. Self-hosted Supabase-managed `auth`, `storage`, `realtime` objects exist before project SQL.
2. `00_extensions.sql` creates `private`/`extensions` and `pgcrypto`; `10_types.sql` owns reusable enum/domain types only when inventory proves they exist.
3. `20_profiles.sql` through `60_social.sql` create final tables, constraints, indexes; FK order is profiles/platform users → legacy learning → workspaces/documents → outputs → social/challenges.
4. `70_functions.sql` depends on all tables plus `auth.uid`, `storage`, `realtime`, and pgcrypto. Exact signatures are API contracts used by `.rpc()` callers.
5. `80_rls.sql` depends on tables and private authorization helpers. Workspace policy chain is `workspace_members` → helper → workspace/document/output/item policies.
6. `90_storage.sql` depends on bucket catalog and helpers `storage_object_workspace_id`, `storage_object_profile_avatar_owner_id`, `social_are_accepted_friends`.
7. Triggers link `set_updated_at` to mutable tables, username normalization to profiles, direct-message participant/read state and social broadcasts to social tables.
8. Tests depend on all canonical files loaded in filename order; seed runs only after schema and must use stable conflict-safe fixtures.

Application contract map to preserve:
- Tables: `.from()` inventory includes profiles; study_sets/canonical_documents/canonical_sections; approved questions/cards; quiz/study history; all workspace/document/version/output/snapshot tables.
- RPCs: `.rpc()` inventory includes replace/persist/create generation calls; quota and streak calls; friend/profile/message/read/reaction/activity/challenge calls; anonymous import and public-share resolver.
- Storage: bucket literal `doc2quiz`; profile avatar path and workspace path formats must remain accepted.
- Before editing, executor must produce machine-generated sorted inventories from SQL and `src/**/*.{ts,tsx}` and fail on any application identifier absent from canonical catalog (except Supabase-managed objects).

## 3. Duplicate/conflict report

- `private.can_workspace` is defined in workspace foundation then redefined to delegate to `workspace_role` in authorization migration. Canonical file keeps only final delegated behavior; both migrations stay (`20260730150000_workspace_foundation.sql:231-286`, `20260730150200_phase10_workspace_authorization.sql:79-122`).
- Workspace RLS policies and core RPCs are created in `20260730150000`/`150100`, then replaced in `20260730150200`; canonical files keep final helper predicates and RPC bodies (`20260730150200_phase10_workspace_authorization.sql:143-545,551-1161`).
- `persist_canonical_version`, `create_learning_output`, and `resolve_learning_output_bridge` receive SECURITY DEFINER/search-path corrections in `20260730192000_fix_workspace_rpc_private_schema.sql:8-28`; canonical definitions must incorporate corrections without deleting corrective migration.
- `set_profile_username` and `send_friend_request` are corrected in `20260730191000_fix_friend_request_username_lookup.sql`; canonical functions use final fallback/backfill-aware logic. `20260730190000` and `191000` data fixes remain history.
- `private.storage_object_profile_avatar_owner_id` and own-avatar policies are corrected in `20260731180000_fix_profile_avatar_storage_rls.sql`; canonical storage uses corrected final form, while friend-avatar policy remains additive.
- `list_accepted_friends` is replaced to include avatar paths (`20260731004000_friend_list_avatar_paths.sql`); keep final response shape.
- Direct-message listing is superseded by read-state migration (`20260731013000_direct_message_read_state.sql`); keep participant/read semantics and final response fields.
- Realtime conversation policy is replaced by explicit read/send policies in `20260731101000`; canonical RLS excludes superseded policy name and keeps final pair.
- Learning streak recovery count corrected by `20260730180100_fix_learning_streak_recovery_count.sql`; canonical function uses corrected count.
- Legacy `canonical_sections` versus `canonical_version_sections` is intentional coexistence, not duplicate; both have active callers/tests and cannot be removed.
- Removal rule: no canonical omission solely from similar names. For each exclusion, record prior definition, final replacing migration, same signature/policy target, and app-call compatibility in `00_schema_contract.sql` comments/assertions.

## 4. Security findings

- High: repository baseline assumes pre-existing `public.profiles`; fresh canonical install can be incomplete unless exact profile base contract/provisioning source is found. Resolve from repository evidence, or make prerequisite assertion fail clearly; never fabricate auth trigger behavior.
- High: multiple SECURITY DEFINER functions use `SET search_path = public` or `public, private/extensions` rather than `''`, including social and study functions (`20260730140400_phase10_social_safety.sql:137-184`, `20260730170000_friends_messages_presence.sql:48-180`, `20260731100000_phase12_study_together_foundation.sql:65-159`). Canonicalization must restrict search paths and schema-qualify all referenced objects/operators/functions without changing behavior.
- High: PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Existing migrations often revoke from `public, anon` but not always authenticated; canonical functions must first `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, then grant exact intended role(s). Admin functions such as `purge_expired_user_reports` and reminder sweeps must remain unavailable to clients.
- Medium: private helpers are sometimes executable by authenticated solely for RLS evaluation. Preserve required helper grants, but remove direct public/default execution only when catalog tests prove policy execution still works.
- Medium: table privileges and RLS are separate. Canonical tests must assert both `relrowsecurity=true` and intended table/function ACLs; service_role bypass expectations must be explicit.
- Medium: SECURITY DEFINER ownership affects privilege. Tests must assert owner is trusted deployment owner and not `anon`/`authenticated`; canonical files must not transfer ownership speculatively.
- Medium: realtime and storage policies cross platform schemas. Preserve topic membership/friend checks and bucket/path checks; never loosen them to make tests pass.
- Required invariant query: every `pg_proc.prosecdef` in project schemas has non-null `proconfig` containing `search_path`, no unexpected PUBLIC execute privilege, and explicit expected-role matrix.

## 5. Migration risk report

- Applied-history mutation: catastrophic checksum/divergence risk. Mitigation: hash all `supabase/migrations/*.sql` before work and assert hashes unchanged afterward.
- Final-state reconstruction: `CREATE OR REPLACE` and policy replacements mean concatenating first definitions is wrong. Mitigation: resolve each object by chronological signature/target and test catalog parity against migration-built disposable DB.
- Data migrations/backfills: canonical fresh schema must not replay production corrective data updates, while existing installs still need them. Mitigation: leave migration logic immutable; canonical files contain final constraints/defaults/functions only; seed supplies fresh fixtures.
- Platform ownership: storage/realtime/auth catalogs differ from plain PostgreSQL. Mitigation: tests run only on disposable self-hosted Supabase PostgreSQL image with platform migrations present; canonical SQL never creates platform tables.
- Function overload/grants: revoking wrong signature leaves callable overload. Mitigation: inventory `pg_proc` identity arguments and assert ACL per exact `regprocedure`.
- Dependency order: functions/policies may reference later objects. Mitigation: strict numeric schema order and transaction per file; `70` after tables, `80/90` after helpers.
- Policy OR semantics: additive policies can broaden access. Mitigation: parity tests exercise positive and negative role cases, including blocked/nonfriend/nonmember.
- Trigger duplication: non-repeatable `CREATE TRIGGER` can duplicate/fail. Mitigation: canonical fresh composition uses deterministic named trigger replacement and catalog cardinality assertions.
- Existing data: adding checks/unique indexes can fail on drift. Mitigation: this task creates no rollout migration and makes no production DDL; report drift from read-only catalog comparison for separate corrective migration review.
- Dirty worktree: generated `.next/**` and user `.env.example` changes are unrelated. Mitigation: path-scoped writes/status checks; never clean/reset/stash or stage unrelated paths.

## 6. Proposed file tree

```text
supabase/
  migrations/                         # immutable historical ledger; unchanged
  schemas/
    00_extensions.sql                 # schemas, pgcrypto, prerequisites
    10_types.sql                      # proven enum/domain types
    20_profiles.sql                   # profile/onboarding table contract, indexes
    30_workspaces.sql                 # workspaces, members, invitations/shares
    40_documents.sql                  # legacy + versioned document structures
    50_learning.sql                   # outputs, quiz/cards, sessions, quota, streaks, attempts
    60_social.sql                     # friends, messages, reactions, notifications, challenges
    70_functions.sql                  # final helpers/RPCs/triggers, hardened ACL/search_path
    80_rls.sql                        # final public/private/realtime RLS and grants
    90_storage.sql                    # doc2quiz bucket and final storage policies
  tests/database/
    00_schema_contract.sql
    10_rls_isolation.sql
    20_workspace_access.sql
    30_profile_friend_access.sql
    40_rpc_permissions.sql
    50_onboarding.sql
    60_messages_read_state.sql
    70_anonymous_quiz_attempts.sql
    80_storage_access.sql
  tests/                              # existing historical tests retained unchanged
  seed.sql
```

## 7. Refactoring plan

Refactor is additive canonicalization only. Build two disposable databases: A from immutable migrations, B from ordered canonical schema files. Compare normalized catalogs (tables/columns/defaults/nullability, constraints/FKs, indexes, functions/signatures/security/config/ACLs, triggers, policies, table ACLs, bucket rows). Differences require evidence-backed correction; no behavior change accepted. Keep existing `supabase/tests/*.sql`; port/partition their assertions into `supabase/tests/database/` without deleting originals.

## 8. Rollback strategy

- Code rollback: remove/revert only newly added `supabase/schemas/**`, `supabase/tests/database/**`, and `supabase/seed.sql`; immutable migrations and production remain untouched.
- Validation rollback: disposable DBs are dropped/recreated; never issue rollback DDL against production.
- Deployment rollback: canonical files are not an in-place migration mechanism. Existing installs continue using immutable migration chain. If future deployment consumes canonical files, deploy only to fresh instances after parity pass.
- Data rollback: none required because plan performs no production mutation. Seed is transaction-safe/repeatable and contains synthetic IDs only.
- Security rollback: if hardened search_path/ACL causes parity failure, restore exact historical effective behavior in canonical file and record finding; do not weaken live DB or edit historical migration.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Freeze history and generate authoritative inventories</name>
  <files>supabase/tests/database/00_schema_contract.sql</files>
  <behavior>
    - Migration file hashes are identical before and after work.
    - Every application `.from`, `.rpc`, view, selected column, and storage bucket/path contract maps to an existing final object.
    - Disposable migration-built database catalog captures columns, constraints, indexes, policies, triggers, functions, ACLs, RLS flags, buckets, and storage/realtime policies.
  </behavior>
  <action>Record SHA-256 hashes for all 34 migration files outside tracked output, scan all `src/**/*.{ts,tsx,js,jsx}` callers (including dynamically typed `RpcClient` casts), and query a disposable self-hosted Supabase PostgreSQL database built from migrations. Add catalog assertions to `00_schema_contract.sql`, including exact `regprocedure` signatures, SECURITY DEFINER search_path, PUBLIC execute denial, RLS enabled, expected trigger cardinality, and application identifier coverage. Do not use Supabase CLI. Treat missing `profiles` foundation as blocking evidence: locate exact source or encode explicit platform prerequisite assertion rather than inventing DDL.</action>
  <verify><automated>psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/00_schema_contract.sql</automated></verify>
  <done>Object inventory and dependency evidence are executable; migration hashes captured; every caller resolves; unresolved prerequisite stops execution clearly.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Canonicalize foundations, profiles, workspaces, and documents</name>
  <files>supabase/schemas/00_extensions.sql, supabase/schemas/10_types.sql, supabase/schemas/20_profiles.sql, supabase/schemas/30_workspaces.sql, supabase/schemas/40_documents.sql, supabase/tests/database/10_rls_isolation.sql, supabase/tests/database/20_workspace_access.sql, supabase/tests/database/50_onboarding.sql</files>
  <behavior>
    - Fresh canonical load reproduces final profile, workspace, legacy document, and versioned document catalogs.
    - Owner/editor/viewer/nonmember matrix and cross-user isolation match existing tests.
    - Onboarding fields accept valid values, reject invalid values, and preserve profile self-update rules.
  </behavior>
  <action>Transcribe final effective DDL only, ordered by dependencies. Preserve legacy/versioned coexistence, exact names/defaults/checks/FKs/indexes and owner/member roles. Keep policies/functions out of domain files except unavoidable type/table prerequisites; put authorization behavior in later files. Port assertions from `supabase/tests/workspace_rls.sql` and `phase10_workspace_authorization.sql`; add onboarding update/isolation cases from `src/app/api/profile/route.ts` contract. Use explicit schemas and repeatable safe DDL.</action>
  <verify><automated>psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/10_rls_isolation.sql -f supabase/tests/database/20_workspace_access.sql -f supabase/tests/database/50_onboarding.sql</automated></verify>
  <done>Foundational domains match migration-built catalog and required isolation/workspace/onboarding behaviors pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Canonicalize learning and social data domains</name>
  <files>supabase/schemas/50_learning.sql, supabase/schemas/60_social.sql, supabase/tests/database/30_profile_friend_access.sql, supabase/tests/database/60_messages_read_state.sql, supabase/tests/database/70_anonymous_quiz_attempts.sql</files>
  <behavior>
    - Learning, quota, streak, anonymous import, social, messaging, read-state, notification, reaction, and study-together tables match final history.
    - Friend-only profile/quiz access denies nonfriends and blocked users.
    - Message participants see allowed messages/read state; outsiders cannot read or mutate.
    - Anonymous attempts import only to authenticated owner and remain idempotent per existing contract.
  </behavior>
  <action>Build final table/constraint/index definitions from chronological last-write evidence. Preserve corrective outcomes (streak count, username normalization, avatar metadata, direct read state, bounded-list indexes) and all intentional legacy bridges. Port and split assertions from existing social, message, anonymous-attempt, and bounded-list SQL tests. Do not redesign statuses, merge tables, rename objects, or remove indexes without catalog and query-caller proof.</action>
  <verify><automated>psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/30_profile_friend_access.sql -f supabase/tests/database/60_messages_read_state.sql -f supabase/tests/database/70_anonymous_quiz_attempts.sql</automated></verify>
  <done>Learning/social catalogs match and profile/friend/message/anonymous positive and denial matrices pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Consolidate final functions, triggers, and privileges</name>
  <files>supabase/schemas/70_functions.sql, supabase/tests/database/40_rpc_permissions.sql</files>
  <behavior>
    - Every application RPC signature exists with unchanged request/response/error behavior.
    - Every SECURITY DEFINER has fixed restricted search_path and qualified references.
    - PUBLIC/anon/authenticated/service_role execute privileges exactly match intended contract.
    - Each named trigger exists once on intended relation/function.
  </behavior>
  <action>For each function signature, select chronologically final body, incorporate later corrective ALTER FUNCTION security/search_path state, and consolidate once in `70_functions.sql`. Qualify all object references; use `search_path=''` where possible and only trusted required schemas otherwise. Revoke execute from PUBLIC, anon, and authenticated first, then grant authenticated/service_role only where historical behavior and callers require it. Preserve RPC JSON keys, error strings, side effects, volatility, trigger timing, and overloads. Test unauthorized invocations as roles, not only ACL catalog rows.</action>
  <verify><automated>psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/40_rpc_permissions.sql</automated></verify>
  <done>RPC callers remain compatible; SECURITY DEFINER/search_path/ACL invariants and trigger cardinality pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Consolidate final RLS, realtime, and storage policy state</name>
  <files>supabase/schemas/80_rls.sql, supabase/schemas/90_storage.sql, supabase/tests/database/80_storage_access.sql</files>
  <behavior>
    - Every user-data table and `realtime.messages` target has RLS enabled.
    - Owner/editor/viewer/member/friend/nonfriend/blocked/anon behavior matches migration-built database.
    - Own avatar, friend avatar, legacy owner object, workspace member read, workspace editor write, outsider denial, and wrong-bucket denial pass.
  </behavior>
  <action>Materialize only final effective policy set after all historical replacements, while retaining additive policies required for OR semantics. Preserve table grants separately from policy predicates. Build private `doc2quiz` bucket idempotently and retain legacy owner, workspace path, own-profile-avatar, and friend-avatar policy behavior. Assert no RLS disable statements and compare normalized `pg_policies`/ACL catalogs between migration-built and canonical-built databases.</action>
  <verify><automated>psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/database/10_rls_isolation.sql -f supabase/tests/database/20_workspace_access.sql -f supabase/tests/database/30_profile_friend_access.sql -f supabase/tests/database/80_storage_access.sql</automated></verify>
  <done>Final table/realtime/storage policy catalogs and complete access matrix match current behavior.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Add repeatable seed and prove migration-to-canonical parity</name>
  <files>supabase/seed.sql, supabase/tests/database/00_schema_contract.sql</files>
  <behavior>
    - Seed can run twice without duplicates or destructive updates.
    - Migration-built and canonical-built disposable databases have equivalent normalized project catalogs.
    - Existing SQL tests and all new database tests pass against self-hosted Supabase PostgreSQL.
    - Migration hashes and unrelated dirty worktree paths remain unchanged.
  </behavior>
  <action>Create synthetic deterministic seed rows using explicit columns and conflict-safe inserts; no secrets, production IDs, or dependency on Supabase CLI. Build DB A from immutable migrations and DB B from `schemas/*.sql` in lexical order, run seed twice on B, export normalized catalog snapshots, and diff them with an explicit allowlist only for intentional canonical composition metadata (never behavior/ACL/policy differences). Run existing `supabase/tests/*.sql` plus new tests. Re-hash migrations and inspect path-scoped git diff/status; fail if any migration, `.next/**`, `.env.example`, or unrelated user file changed.</action>
  <verify><automated>psql "$CANONICAL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql -f supabase/seed.sql &amp;&amp; for f in supabase/tests/database/*.sql; do psql "$CANONICAL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || exit 1; done</automated></verify>
  <done>Fresh canonical build is repeatable, catalog parity has no unexplained differences, required and existing tests pass, migration hashes unchanged, dirty user/generated files untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| anon/authenticated client → PostgREST/RPC | Untrusted IDs, JSON, text, pagination, and onboarding values cross into tables/functions. |
| user → workspace/friend resources | Membership, ownership, accepted friendship, and block status determine visibility/mutation. |
| client → storage.objects | Untrusted object paths determine owner/workspace/avatar authority. |
| trigger/RPC → elevated database owner | SECURITY DEFINER bypasses caller privileges and must constrain search path and ACL. |
| project SQL → Supabase-managed schemas | Project depends on self-hosted auth/storage/realtime contracts but must not own them. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-QUICK-01 | Spoofing | auth.uid-based helpers/RPCs | mitigate | Preserve auth-null denial and role/JWT matrix tests. |
| T-QUICK-02 | Tampering | SECURITY DEFINER search path | mitigate | Fixed restricted search_path, schema qualification, trusted owner assertions. |
| T-QUICK-03 | Repudiation | migration history | mitigate | SHA-256 immutable migration manifest before/after. |
| T-QUICK-04 | Information disclosure | RLS, friend profiles/messages/storage | mitigate | Positive and negative isolation tests for nonmember/nonfriend/blocked/anon. |
| T-QUICK-05 | Denial of service | unbounded RPC input/listing | mitigate | Preserve existing limits, validation, indexes, rate-limit event behavior. |
| T-QUICK-06 | Elevation of privilege | default PUBLIC execute/table grants | mitigate | Revoke-first exact-signature ACLs and `has_function_privilege` tests. |
| T-QUICK-07 | Tampering | canonical versus migration drift | mitigate | Two-database normalized catalog parity gate. |
| T-QUICK-SC | Tampering | package installs | accept | No package-manager install or new dependency planned. |
</threat_model>

## Multi-source coverage audit

| SOURCE | ID | Requirement | Task | Status | Evidence |
|---|---|---|---|---|---|
| GOAL | QUICK-DB-AUDIT | Deep migration and caller audit with eight reports | 1 | COVERED | Sections 1-8 plus executable inventory |
| GOAL | QUICK-DB-CANONICAL | Exact ten-file canonical schema | 2-5 | COVERED | Proposed tree and domain tasks |
| REQ | QUICK-DB-SECURITY | Preserve/harden RLS, RPC, trigger, grants, storage, SECURITY DEFINER | 4-5 | COVERED | Security findings and threat model |
| REQ | QUICK-DB-REGRESSION | Required database behavior tests | 2-6 | COVERED | Nine domain test files |
| CONTEXT | immutable migrations | Never edit applied/corrective migrations | 1,6 | COVERED | Hash gate and path guardrails |
| CONTEXT | no destructive/speculative redesign | Preserve production behavior/data/contracts | 1-6 | COVERED | Catalog parity and no rollout migration |
| CONTEXT | self-hosted, no Supabase CLI | Direct PostgreSQL/Supabase assumptions | 1-6 | COVERED | `psql` verification only |
| CONTEXT | dirty worktree | Preserve unrelated `.next` and user changes | 1,6 | COVERED | Path-scoped status/hash checks |

<verification>
1. Migration SHA-256 manifest unchanged.
2. Lexical canonical load succeeds on disposable self-hosted Supabase PostgreSQL with `ON_ERROR_STOP=1`.
3. Normalized catalogs from migration-built and canonical-built DBs have no unexplained differences.
4. All `supabase/tests/database/*.sql` pass; existing `supabase/tests/*.sql` remain and pass where compatible with direct `psql` invocation.
5. Every application table/view/RPC/column/bucket reference resolves.
6. All SECURITY DEFINER, ACL, RLS, trigger, realtime, and storage invariants pass.
7. `git diff -- supabase/migrations` is empty; unrelated dirty paths unchanged.
</verification>

<success_criteria>
- Ten requested canonical schema files exist and represent final effective history without editing migrations.
- Eight mandatory audit/report sections precede executable tasks in this plan.
- Required RLS isolation, workspace, profile/friend, RPC, onboarding, messages/read, anonymous attempts, and storage tests pass.
- Fresh canonical schema and immutable migration chain are behaviorally/catalog equivalent for project-owned objects.
- Seed is synthetic, repeatable, and non-destructive.
</success_criteria>

<output>
Create `.planning/quick/260731-tjc-audit-and-refactor-self-hosted-supabase-/260731-tjc-SUMMARY.md` after execution, including migration hash result, catalog diff result, test commands/results, unresolved platform prerequisites, and exact changed paths.
</output>
