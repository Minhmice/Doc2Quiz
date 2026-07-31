---
phase: quick-260731-tui-create-clean-maintainable-supabase-schem
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
autonomous: true
requirements:
  - QUICK-260731-TUI
must_haves:
  truths:
    - "A reader can reconstruct current database structure from exactly ten ordered declarative schema files without changing migration history."
    - "Every effective table, column, constraint, enum, view, function, trigger, index, RLS policy, grant, permission, bucket, and storage policy from migration history is represented once in its final form."
    - "Every table, column, RPC, view, and storage bucket referenced by application code resolves to a matching declarative definition."
    - "Schema mirror preserves current production behavior, ownership boundaries, security-definer settings, search paths, RLS predicates, grants, trigger behavior, indexes, and storage access."
  artifacts:
    - path: "supabase/schemas/00_extensions.sql"
      provides: "Required schemas and extensions"
    - path: "supabase/schemas/10_types.sql"
      provides: "Declarative enum and shared database type definitions"
    - path: "supabase/schemas/20_profiles.sql"
      provides: "Profile and onboarding structure"
    - path: "supabase/schemas/30_workspaces.sql"
      provides: "Workspace, membership, invitation, sharing, and authorization-adjacent relational structure"
    - path: "supabase/schemas/40_documents.sql"
      provides: "Document, version, canonical content, section, and source snapshot structure"
    - path: "supabase/schemas/50_learning.sql"
      provides: "Study sets, outputs, questions, flashcards, sessions, mistakes, streaks, quota, coupon, and attempt-import structure"
    - path: "supabase/schemas/60_social.sql"
      provides: "Friend, block, report, messaging, presence, reaction, notification, and study-together structure"
    - path: "supabase/schemas/70_functions.sql"
      provides: "Final function, RPC, and trigger definitions with execution permissions"
    - path: "supabase/schemas/80_rls.sql"
      provides: "Final RLS enablement, table policies, table grants, and realtime policies"
    - path: "supabase/schemas/90_storage.sql"
      provides: "Storage bucket declaration and final storage object policies"
  key_links:
    - from: "supabase/schemas/70_functions.sql"
      to: "supabase/schemas/20_profiles.sql through supabase/schemas/60_social.sql"
      via: "functions reference relations created earlier in lexical execution order"
      pattern: "create or replace function"
    - from: "supabase/schemas/80_rls.sql"
      to: "supabase/schemas/70_functions.sql"
      via: "policy predicates may call helper functions defined before policy creation"
      pattern: "create policy"
    - from: "supabase/schemas/90_storage.sql"
      to: "storage.objects and doc2quiz bucket"
      via: "bucket declaration plus effective object policies"
      pattern: "storage\\.(buckets|objects)"
---

<objective>
Create maintainable declarative mirror of current Supabase database in exactly ten ordered schema files.

Purpose: Make current database structure readable and reproducible while preserving production data, behavior, security, permissions, and immutable migration history.
Output: `supabase/schemas/00_extensions.sql` through `supabase/schemas/90_storage.sql`, containing effective final database state only.
</objective>

<execution_context>
@C:/Users/minhmice/.cursor/get-shit-done/workflows/execute-plan.md
@C:/Users/minhmice/.cursor/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@supabase/migrations/
@src/

<constraints>
- Preserve all existing user changes. Inspect `git status --short` and `git diff -- supabase/migrations supabase/schemas` before writing; do not overwrite pre-existing schema-file edits without reconciling them.
- Treat every file under `supabase/migrations/**` as immutable history. Never edit, rename, delete, squash, reorder, or generate a replacement migration.
- Create exactly these schema files and no other production or validation files: `00_extensions.sql`, `10_types.sql`, `20_profiles.sql`, `30_workspaces.sql`, `40_documents.sql`, `50_learning.sql`, `60_social.sql`, `70_functions.sql`, `80_rls.sql`, `90_storage.sql`.
- Mirror effective final state after migrations apply in filename order. Later `CREATE OR REPLACE`, policy replacement, constraint repair, column addition, and permission changes supersede earlier definitions; do not preserve obsolete intermediate definitions as active declarations.
- Preserve identifiers, SQL types, defaults, nullability, generated values, checks, PK/FK/unique constraints, cascade actions, indexes and predicates, schemas, owners where declared, function signatures/bodies/languages/volatility/security/search paths, triggers, RLS enablement and predicates, grants/revokes, realtime policies, buckets, and storage policies exactly in behavior.
- Declarative files describe structure only. No destructive data migration, reset, seed, backfill, remote push, or production database mutation.
</constraints>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build authoritative effective-schema inventory</name>
  <files>supabase/schemas/00_extensions.sql, supabase/schemas/10_types.sql, supabase/schemas/20_profiles.sql, supabase/schemas/30_workspaces.sql, supabase/schemas/40_documents.sql, supabase/schemas/50_learning.sql, supabase/schemas/60_social.sql, supabase/schemas/70_functions.sql, supabase/schemas/80_rls.sql, supabase/schemas/90_storage.sql</files>
  <action>Read every `supabase/migrations/**/*.sql` file in lexical order and inventory all schemas, extensions, enum/types, tables, columns, constraints, views, functions, RPC signatures, triggers, indexes, RLS enablement, policies, grants/revokes, realtime objects, storage buckets, and storage policies. Resolve each object to its effective final definition by applying later alterations and replacements; retain intentional coexistence such as overloaded function signatures. Search all application SQL access under `src/**/*.{ts,tsx}` including literal and typed/dynamic `.from(...)`, `.rpc(...)`, `.storage.from(...)`, select column strings, generated database types, and any raw SQL references; add each referenced relation, column, RPC, view, and bucket to a cross-check inventory. Use inventory during authoring, not a new committed artifact. Do not modify migration or application files.</action>
  <verify>
    <automated>powershell -NoProfile -Command "$m=(Get-ChildItem supabase/migrations -Recurse -File -Filter *.sql).Count; if($m -lt 1){throw 'No migrations inventoried'}; $refs=(Get-ChildItem src -Recurse -File -Include *.ts,*.tsx | Select-String -Pattern '\.from\(|\.rpc\(|storage\.from\(').Count; if($refs -lt 1){throw 'No application database references inventoried'}; Write-Output \"migrations=$m appRefs=$refs\""</automated>
  </verify>
  <done>All migration files and application database call sites have been inspected; effective objects and app-facing contracts have an explicit destination among ten requested schema files; migrations and application code remain byte-for-byte untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Author ordered declarative schema mirror</name>
  <files>supabase/schemas/00_extensions.sql, supabase/schemas/10_types.sql, supabase/schemas/20_profiles.sql, supabase/schemas/30_workspaces.sql, supabase/schemas/40_documents.sql, supabase/schemas/50_learning.sql, supabase/schemas/60_social.sql, supabase/schemas/70_functions.sql, supabase/schemas/80_rls.sql, supabase/schemas/90_storage.sql</files>
  <action>Create exactly ten requested files. Place schemas/extensions in `00_extensions.sql`; enums/shared types in `10_types.sql`; profile/onboarding relations in `20_profiles.sql`; workspace/member/invitation/share relations and indexes in `30_workspaces.sql`; document/version/canonical/source relations and indexes in `40_documents.sql`; study-set/output/question/flashcard/session/mistake/streak/quota/coupon/import relations and indexes in `50_learning.sql`; friend/safety/message/presence/reaction/notification/study-together relations and indexes in `60_social.sql`; all final public/private functions, RPCs, trigger functions, triggers, and function execute grants/revokes in `70_functions.sql`; RLS enablement, effective non-storage policies, realtime policies, and relation grants/revokes in `80_rls.sql`; bucket declaration plus effective `storage.objects` policies in `90_storage.sql`. Preserve executable dependency order within each file. Consolidate migration evolution into current definitions: include final columns/constraints directly in table declarations where behavior-equivalent, emit alterations only where required for dependency fidelity, and include only final replacement body/policy state. Do not add cleanup drops, data changes, speculative objects, formatting-driven renames, new abstractions, or security hardening beyond migration history.</action>
  <verify>
    <automated>powershell -NoProfile -Command "$expected=@('00_extensions.sql','10_types.sql','20_profiles.sql','30_workspaces.sql','40_documents.sql','50_learning.sql','60_social.sql','70_functions.sql','80_rls.sql','90_storage.sql'); $actual=@(Get-ChildItem supabase/schemas -File -Filter *.sql | Sort-Object Name | ForEach-Object Name); if((Compare-Object $expected $actual)){throw 'Schema filename set differs'}; $empty=@(Get-ChildItem supabase/schemas -File -Filter *.sql | Where-Object Length -eq 0); if($empty){throw ('Empty schema files: '+($empty.Name -join ','))}; git diff --exit-code -- supabase/migrations; if($LASTEXITCODE){throw 'Migration history changed'}"</automated>
  </verify>
  <done>Exactly ten non-empty schema files exist, objects are grouped into requested domains and executable order, final definitions preserve migration-derived behavior, and no migration file changed.</done>
</task>

<task type="auto">
  <name>Task 3: Prove migration and application-reference completeness</name>
  <files>supabase/schemas/00_extensions.sql, supabase/schemas/10_types.sql, supabase/schemas/20_profiles.sql, supabase/schemas/30_workspaces.sql, supabase/schemas/40_documents.sql, supabase/schemas/50_learning.sql, supabase/schemas/60_social.sql, supabase/schemas/70_functions.sql, supabase/schemas/80_rls.sql, supabase/schemas/90_storage.sql</files>
  <action>Perform bidirectional completeness review. For migrations, compare normalized effective object inventory against declarative files by object kind and identity: tables plus final columns/constraints, enums/views, function signatures and final bodies, triggers, indexes including predicates, RLS enablement, final policy names/bodies/roles/actions, grants/revokes, realtime policies, bucket rows, and storage policies. For application references, verify every literal/dynamic table, selected/inserted/updated column, RPC and argument contract, view, and bucket is defined; trace constants and wrappers rather than checking only literal calls. Resolve every mismatch in schema files only. Inspect `git diff --check`, `git diff -- supabase/schemas`, and `git status --short`; confirm no path outside ten schema files plus quick-task planning/state artifacts changed by execution and no existing unrelated user change was altered. Do not run `supabase db reset`, `db push`, or any command against remote/production.</action>
  <verify>
    <automated>powershell -NoProfile -Command "$sql=(Get-ChildItem supabase/schemas -File -Filter *.sql | Get-Content -Raw) -join \"`n\"; $app=(Get-ChildItem src -Recurse -File -Include *.ts,*.tsx | Get-Content -Raw) -join \"`n\"; $names=[regex]::Matches($app,'(?:\.from|\.rpc|storage\.from)\(\s*[\"'']([^\"'']+)[\"'']') | ForEach-Object {$_.Groups[1].Value} | Sort-Object -Unique; $missing=@($names | Where-Object {$sql -notmatch ('(?i)(?<![a-z0-9_])'+[regex]::Escape($_)+'(?![a-z0-9_])')}); if($missing){throw ('Missing literal app references: '+($missing -join ','))}; git diff --check; if($LASTEXITCODE){throw 'SQL diff has whitespace errors'}; git diff --exit-code -- supabase/migrations; if($LASTEXITCODE){throw 'Migration history changed'}; Write-Output ('literalAppReferences='+$names.Count)"</automated>
  </verify>
  <done>Object-by-object migration audit has no omissions or stale definitions; application reference audit has no unresolved relation, column, RPC, view, or bucket; SQL diff is clean; migration history and unrelated user work remain unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| application to Supabase API | Untrusted authenticated/anonymous requests reach tables, RPCs, views, realtime, and storage through grants and RLS. |
| security-definer function to protected data | RPC bodies cross caller privileges and depend on exact authorization checks and `search_path`. |
| declarative mirror to future database reconstruction | Missing or broadened policy, grant, trigger, constraint, or function semantics could silently change security or data behavior when schema files are later applied. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QUICK-TUI-01 | Tampering | `supabase/migrations/**` and production data | mitigate | Keep migrations immutable; verify `git diff --exit-code -- supabase/migrations`; run no reset, push, backfill, or remote SQL. |
| T-QUICK-TUI-02 | Elevation of Privilege | security-definer functions, grants, RLS and storage policies | mitigate | Mirror final signatures, bodies, authorization predicates, roles, `security definer`, `search_path`, grants/revokes, and policy expressions exactly from effective migration state. |
| T-QUICK-TUI-03 | Information Disclosure | profile, social, workspace, realtime, and storage access | mitigate | Preserve final RLS enablement and policy role/action/USING/WITH CHECK clauses; compare all later policy replacements and storage fixes before completion. |
| T-QUICK-TUI-04 | Denial of Service | indexes, uniqueness constraints, trigger behavior | mitigate | Include all effective indexes, predicates, constraints, and triggers; reject inventory mismatches rather than accepting partial mirror. |
| T-QUICK-TUI-05 | Repudiation | completeness claim | mitigate | Produce reproducible migration-object and application-reference checks plus clean scoped git diff evidence. |
| T-QUICK-TUI-SC | Tampering | package installs | accept | No package install or dependency change permitted by this plan. |
</threat_model>

<verification>
1. Exactly ten requested files exist under `supabase/schemas/`; no extra schema SQL file exists.
2. All 35 current migration files remain unchanged.
3. Effective object inventory from migrations has one final declarative representation per active object/signature.
4. All application table, column, RPC, view, and bucket references resolve against declarative files, including references hidden behind constants/wrappers.
5. `git diff --check` passes and scoped status shows only ten schema files plus allowed quick-task planning/state artifacts from this task; unrelated dirty work is preserved.
6. No database mutation, reset, remote push, migration rewrite, package install, or application-code edit occurs.
</verification>

<source_audit>
SOURCE | ID | Feature/Requirement | Plan | Status | Notes
GOAL | QUICK-260731-TUI | Clean maintainable declarative database structure in exactly ten files | 01 | COVERED | Tasks 1-3 inventory, author, and prove mirror.
REQ | QUICK-260731-TUI | Preserve production behavior, data, RLS, RPCs, triggers, grants, indexes, storage, and migration history | 01 | COVERED | Constraints, authoring task, and bidirectional audit enforce fidelity.
RESEARCH | — | No research phase | 01 | COVERED | User explicitly prohibited research; plan uses repository evidence only.
CONTEXT | — | Existing migrations immutable | 01 | COVERED | Every task forbids migration edits and automated checks gate changes.
CONTEXT | — | Inspect migrations and application references | 01 | COVERED | Task 1 inventories both; Task 3 validates both.
CONTEXT | — | Target only schema files plus quick planning/state artifacts | 01 | COVERED | Frontmatter and scope checks restrict paths.
</source_audit>

<success_criteria>
- Declarative schema is complete, ordered, maintainable, and behavior-equivalent to current migration-derived state.
- Current application database contracts all exist in declarative mirror.
- Existing migration history, production data, production behavior, and unrelated user changes remain untouched.
- Exactly requested ten schema files are created; no new dependency, helper script, migration, or application change is introduced.
</success_criteria>

<output>
Create `.planning/quick/260731-tui-create-clean-maintainable-supabase-schem/260731-tui-SUMMARY.md` when done and update `.planning/STATE.md` only through normal quick-task completion bookkeeping.
</output>
