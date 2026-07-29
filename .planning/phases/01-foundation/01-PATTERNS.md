# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 24
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_v21_baseline.sql` | migration | batch | `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql` | role-match |
| `src/lib/supabase/env.ts` | config | — | git HEAD `src/lib/supabase/env.ts` | exact |
| `src/lib/supabase/browser.ts` | utility | request-response | git HEAD `src/lib/supabase/browser.ts` | exact |
| `src/lib/supabase/server.ts` | utility | request-response | git HEAD `src/lib/supabase/server.ts` | exact |
| `src/lib/supabase/middlewareClient.ts` | middleware | request-response | git HEAD `src/lib/supabase/middlewareClient.ts` | exact |
| `src/lib/supabase/auth-guard.ts` | middleware | request-response | git HEAD `src/lib/supabase/auth-guard.ts` | exact |
| `src/lib/client/supabase.ts` | utility | request-response | git HEAD `src/lib/supabase/browser.ts` | role-match |
| `src/lib/client/studySetDb.ts` | service | CRUD | git HEAD `src/lib/db/studySetDb.ts` | role-match |
| `src/lib/api/requireApiUser.ts` | middleware | request-response | git HEAD `src/app/api/study-sets/[id]/generate-from-file/route.ts` (inline auth) | partial |
| `src/lib/pipeline/validation.ts` | utility | transform | git HEAD `src/lib/pdf/validatePdfFile.ts` + `docs/pipeline.md` | partial |
| `src/proxy.ts` | middleware | request-response | git HEAD `src/middleware.ts` + current `src/proxy.ts` | exact |
| `src/app/(app)/layout.tsx` | component | request-response | git HEAD `src/app/(app)/layout.tsx` | exact |
| `src/app/(auth)/logout/route.ts` | route | request-response | git HEAD `src/app/(auth)/logout/route.ts` | exact |
| `src/app/(auth)/login/LoginClient.tsx` | component | request-response | current `src/app/(auth)/login/LoginClient.tsx` | exact |
| `src/app/(auth)/signup/SignupClient.tsx` | component | request-response | current `src/app/(auth)/signup/SignupClient.tsx` | exact |
| `src/components/layout/AppTopBar.tsx` | component | request-response | git HEAD `src/app/(auth)/logout/route.ts` | partial |
| `src/app/api/study-sets/route.ts` | route | CRUD | git HEAD `src/lib/db/studySetDb.ts` + `generate-from-file/route.ts` | partial |
| `src/app/api/study-sets/[id]/route.ts` | route | CRUD | git HEAD `src/lib/db/studySetDb.ts` + `generate-from-file/route.ts` | partial |
| `src/app/api/study-sets/[id]/ingest/route.ts` | route | request-response | git HEAD `src/app/api/parse-jobs/route.ts` | role-match |
| `src/app/api/study-sets/[id]/canonicalize/route.ts` | route | request-response | git HEAD `src/app/api/parse-jobs/route.ts` | role-match |
| `src/app/api/study-sets/[id]/quiz/generate/route.ts` | route | request-response | git HEAD `src/app/api/parse-jobs/route.ts` | role-match |
| `src/app/api/study-sets/[id]/flashcards/generate/route.ts` | route | request-response | git HEAD `src/app/api/parse-jobs/route.ts` | role-match |
| `src/types/studySet.ts` | model | — | current `src/types/studySet.ts` + v1 `StudySetRow` in git `studySetDb.ts` | role-match |
| `src/lib/ui/studySetActionLabels.ts` | utility | — | current file (update labels for `pipeline_stage`) | partial |

## Pattern Assignments

### `supabase/migrations/YYYYMMDDHHMMSS_v21_baseline.sql` (migration, batch)

**Analog:** `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql`

**Do NOT copy:** `supabase/migrations/20260725000000_v2_clean_slate.sql` — that is incremental ALTER on v1; D-01 requires one fresh baseline file with no v1 tables (`media_assets`, `ocr_results`, `study_set_documents`, etc.).

**Shared trigger + extension pattern** (lines 1–15):

```sql
begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

**Parent table + composite FK pattern** (lines 27–44, 51–66):

```sql
create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  subtitle text null,
  -- v2.1: pipeline_stage replaces status draft/ready
  pipeline_stage text not null default 'input',
  content_kind text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sets_pipeline_stage_check check (
    pipeline_stage in ('input','raw','canonical','mode_selected','quiz','flashcards')
  ),
  constraint study_sets_content_kind_check check (content_kind is null or content_kind in ('quiz', 'flashcards')),
  constraint study_sets_id_user_id_unique unique (id, user_id)
);

create trigger study_sets_set_updated_at
before update on public.study_sets
for each row execute function public.set_updated_at();
```

**Practice tables shape** (lines 114–179) — carry `approved_questions`, `approved_flashcards`, `quiz_sessions`, `study_wrong_history` verbatim from v1 with composite FK `(study_set_id, user_id)`.

**New v2.1 tables** (no v1 analog — derive from CONTEXT D-04–D-06):

```sql
-- canonical_documents: 1:1 with study_sets
constraint canonical_documents_study_set_fk
  foreign key (study_set_id, user_id)
  references public.study_sets (id, user_id) on delete cascade,
constraint canonical_documents_study_set_id_unique unique (study_set_id)

-- canonical_sections: N:1 with canonical_documents
constraint canonical_sections_document_fk
  foreign key (canonical_document_id, user_id)
  references public.canonical_documents (id, user_id) on delete cascade
```

**RLS policy pattern** (lines 181–215):

```sql
alter table public.study_sets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_select_own') then
    create policy study_sets_select_own on public.study_sets
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  -- repeat insert/update/delete with with check (user_id = auth.uid())
end
$$;
```

**Storage bucket + policies** (lines 380–407 + `20260418_000003_create_storage_bucket_doc2quiz.sql`):

```sql
insert into storage.buckets (id, name, public)
values ('doc2quiz', 'doc2quiz', false)
on conflict (id) do nothing;

create policy doc2quiz_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'doc2quiz' and owner = auth.uid());
```

---

### `src/lib/supabase/env.ts` (config)

**Analog:** git HEAD `src/lib/supabase/env.ts`

**Core pattern** — throw on missing env; keep project names `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`:

```typescript
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}
```

---

### `src/lib/supabase/browser.ts` (utility, request-response)

**Analog:** git HEAD `src/lib/supabase/browser.ts`

**Imports + core pattern:**

```typescript
import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
```

---

### `src/lib/supabase/server.ts` (utility, request-response)

**Analog:** git HEAD `src/lib/supabase/server.ts`

**Core pattern** — `cookies()` from `next/headers`, swallow setAll in RSC:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; refresh happens in proxy.
        }
      },
    },
  });
}
```

---

### `src/lib/supabase/middlewareClient.ts` (middleware, request-response)

**Analog:** git HEAD `src/lib/supabase/middlewareClient.ts`

**Preserve `x-next-pathname` injection** (lines 6–8, 24–29) for `requireUser()` deep-link redirects.

**Adapt for Phase 1:** Replace `await supabase.auth.getUser()` with `await supabase.auth.getClaims()` per RESEARCH; preserve `setAll` cookie sync:

```typescript
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        const nextHeaders = new Headers(request.headers);
        nextHeaders.set("x-next-pathname", request.nextUrl.pathname);
        supabaseResponse = NextResponse.next({
          request: { headers: nextHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims(); // was getUser() in v1
  return supabaseResponse;
}
```

---

### `src/lib/supabase/auth-guard.ts` (middleware, request-response)

**Analog:** git HEAD `src/lib/supabase/auth-guard.ts`

**Core pattern:**

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "./server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const h = await headers();
    const path = h.get("x-next-pathname");
    const next =
      path && path.startsWith("/") && !path.startsWith("//")
        ? `?next=${encodeURIComponent(path)}`
        : "";
    redirect(`/login${next}`);
  }

  return user;
}
```

---

### `src/lib/client/supabase.ts` (utility, request-response)

**Analog:** git HEAD `src/lib/supabase/browser.ts` (thin re-export to minimize import churn)

**Replace mock** in current `src/lib/client/supabase.ts` with:

```typescript
export { createSupabaseBrowserClient } from "@/lib/supabase/browser";
```

`LoginClient.tsx` and `SignupClient.tsx` already import from `@/lib/client/supabase` — no UI file changes needed beyond this re-export.

---

### `src/lib/client/studySetDb.ts` (service, CRUD)

**Analog:** git HEAD `src/lib/db/studySetDb.ts`

**Auth guard for client DB layer** (lines 118–128):

```typescript
async function requireUserId(): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  assertNoError(error, "auth.getUser failed");
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}
```

**List pattern** (lines 321–339):

```typescript
export async function listStudySetMetas(): Promise<StudySetMeta[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_sets")
    .select("id,user_id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  assertNoError(error, "listStudySetMetas failed");
  return ((data ?? []) as StudySetRow[]).map(metaFromRow);
}
```

**Adapt for v2.1:** Query `canonical_documents` instead of `study_set_documents`; map `pipeline_stage` not `status`; drop OCR/PDF/parse_progress columns. Keep public API surface (`listStudySetMetas`, `getStudySetMeta`, `createStudySet`, etc.) to avoid dashboard churn.

---

### `src/lib/api/requireApiUser.ts` (middleware, request-response)

**Analog:** git HEAD `src/app/api/study-sets/[id]/generate-from-file/route.ts` (lines 55–63)

**Extract inline auth into shared helper:**

```typescript
// From generate-from-file/route.ts — inline pattern to extract
const supabase = await createSupabaseServerClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Target shape** (from RESEARCH Pattern 2):

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}
```

---

### `src/lib/pipeline/validation.ts` (utility, transform)

**Analog:** git HEAD `src/lib/pdf/validatePdfFile.ts` + `docs/pipeline.md` (lines 33–47)

**Constants pattern** from `validatePdfFile.ts`:

```typescript
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function validatePdfFile(
  file: File,
): { ok: true } | { ok: false; error: PdfValidationError } {
  const looksPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) {
    return { ok: false, error: "type" };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "size" };
  }
  return { ok: true };
}
```

**Expand to full pipeline contract** — export `SUPPORTED_MIME_TYPES`, `MAX_UPLOAD_BYTES_BY_MIME`, `PasteInput` / `YoutubeInput` / `FileInput` discriminated unions per RESEARCH; no enforcement functions in Phase 1.

**MIME list source:** `docs/pipeline.md` Accept section (PDF, DOCX, PPTX, XLSX, images, audio, HTML, CSV, JSON, XML, plain text, paste, YouTube URL).

---

### `src/proxy.ts` (middleware, request-response)

**Analog:** git HEAD `src/middleware.ts` + current `src/proxy.ts` matcher

**Replace passthrough** (current lines 1–11):

```typescript
import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middlewareClient";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mathjax|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Note:** Export name is `proxy` (Next.js 16), not `middleware`.

---

### `src/app/(app)/layout.tsx` (component, request-response)

**Analog:** git HEAD `src/app/(app)/layout.tsx`

**Restore async layout + requireUser:**

```typescript
import { AppProviders } from "@/components/layout/AppProviders";
import { requireUser } from "@/lib/supabase/auth-guard";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return <AppProviders>{children}</AppProviders>;
}
```

Current working tree omits `requireUser()` — only wraps `AppProviders`.

---

### `src/app/(auth)/logout/route.ts` (route, request-response)

**Analog:** git HEAD `src/app/(auth)/logout/route.ts`

**Core pattern:**

```typescript
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next") ?? "/login";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/login";
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
```

---

### `src/app/(auth)/login/LoginClient.tsx` (component, request-response)

**Analog:** current `src/app/(auth)/login/LoginClient.tsx`

**Already correct** — uses `createSupabaseBrowserClient()` from `@/lib/client/supabase`. No changes beyond restoring real client re-export.

**Open redirect guard** (lines 14–19):

```typescript
const nextPath = useMemo(() => {
  const raw = searchParams.get("next");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}, [searchParams]);
```

**Sign-in flow** (lines 65–75):

```typescript
const supabase = createSupabaseBrowserClient();
const { error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  setError(signInError.message);
  return;
}
router.replace(nextPath);
router.refresh();
```

---

### `src/app/(auth)/signup/SignupClient.tsx` (component, request-response)

**Analog:** current `src/app/(auth)/signup/SignupClient.tsx`

**Signup + fallback sign-in** (lines 52–85) — keep as-is; surfaces `EMAIL_AUTH_SETUP.md` error when confirm-email blocks session.

---

### `src/components/layout/AppTopBar.tsx` (component, request-response)

**Analog:** git HEAD `src/app/(auth)/logout/route.ts`

**Current bug** (lines 217–221) — client-only navigation:

```typescript
<DropdownMenuItem
  className="cursor-pointer"
  onClick={() => {
    router.replace("/login");
  }}
>
  Log out
</DropdownMenuItem>
```

**Fix pattern** — POST to server logout (form submit or fetch):

```typescript
onClick={() => {
  // Option A: hidden form POST to /logout
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/logout";
  document.body.appendChild(form);
  form.submit();
}}
```

Or `fetch("/logout", { method: "POST", redirect: "follow" })` then `router.replace("/login")`.

---

### `src/app/api/study-sets/route.ts` (route, CRUD)

**Analog:** git HEAD `src/lib/db/studySetDb.ts` (CRUD logic) + `generate-from-file/route.ts` (auth)

**GET list pattern** — mirror `listStudySetMetas` but server-side:

```typescript
export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("study_sets")
    .select("id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
```

**POST create** — insert `study_sets` row with `pipeline_stage: 'input'`, optionally create empty `canonical_documents` row in same transaction pattern (or defer to ingest in Phase 2).

**Params pattern** (Next.js 16): use `ctx: { params: Promise<{ id: string }> }` and `await ctx.params` per `generate-from-file/route.ts`.

---

### `src/app/api/study-sets/[id]/route.ts` (route, CRUD)

**Analog:** git HEAD `src/lib/db/studySetDb.ts` (`getStudySetMeta`, `putStudySetMeta`, `deleteStudySet`)

**GET/PATCH/DELETE** — all start with `requireApiUser()`; RLS scopes rows to `user.id`. PATCH allowed fields: `title`, `subtitle`, `content_kind`, `pipeline_stage` (with valid transitions deferred to later phases).

---

### Pipeline step stub routes (route, request-response)

**Files:** `ingest/route.ts`, `canonicalize/route.ts`, `quiz/generate/route.ts`, `flashcards/generate/route.ts`

**Analog:** git HEAD `src/app/api/parse-jobs/route.ts` (lines 44–51)

**Stub response pattern:**

```typescript
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  // Optional: verify study set exists via supabase.from("study_sets").select().eq("id", id).maybeSingle()

  return NextResponse.json(
    {
      error: "not_implemented",
      step: "ingest",
      studySetId: id,
      message: "MarkItDown ingest is implemented in Phase 2.",
    },
    { status: 501 },
  );
}
```

Each stub varies `step` and `message` per pipeline phase.

---

### `src/types/studySet.ts` (model)

**Analog:** current `src/types/studySet.ts` + git `StudySetRow` mapping in `studySetDb.ts`

**Replace `StudySetStatus`** (current lines 1–16):

```typescript
// Before (v1)
export type StudySetStatus = "draft" | "ready";

// After (v2.1)
export type PipelineStage =
  | "input"
  | "raw"
  | "canonical"
  | "mode_selected"
  | "quiz"
  | "flashcards";

export type StudySetMeta = {
  id: string;
  title: string;
  subtitle?: string;
  createdAt: string;
  updatedAt: string;
  pipelineStage: PipelineStage;
  contentKind?: StudyContentKind;
};
```

Drop `StudySetDocumentRecord` or replace with `CanonicalDocumentRecord` referencing new schema.

---

## Shared Patterns

### Authentication (page + API)

**Source:** git HEAD `src/lib/supabase/auth-guard.ts` (pages), `generate-from-file/route.ts` (API)

**Apply to:** `(app)/layout.tsx`, all `/api/study-sets/**` routes

- Pages: `requireUser()` → `redirect('/login?next=...')`
- API: `requireApiUser()` → `401 { error: 'unauthorized' }`
- Defense in depth: Postgres RLS `user_id = auth.uid()` on every table

### Session refresh

**Source:** git HEAD `src/lib/supabase/middlewareClient.ts` + `src/proxy.ts`

**Apply to:** `src/proxy.ts` only — runs before all matched routes; injects `x-next-pathname` header.

### Supabase client trio

**Source:** git HEAD `src/lib/supabase/{env,browser,server,middlewareClient}.ts`

**Apply to:** All auth and data access

| Context | Import |
|---------|--------|
| Client components | `@/lib/client/supabase` → `createSupabaseBrowserClient()` |
| RSC + route handlers | `createSupabaseServerClient()` from `@/lib/supabase/server` |
| Proxy | `updateSession()` from `@/lib/supabase/middlewareClient` |

### RLS + composite FK

**Source:** `supabase/migrations/20260418_000001_doc2quiz_cloud_first.sql`

**Apply to:** All new tables in baseline migration

- Parent: `UNIQUE (id, user_id)` on `study_sets`, `canonical_documents`
- Child FK: `(parent_id, user_id) REFERENCES parent (id, user_id) ON DELETE CASCADE`
- Policies: `{table}_{select|insert|update|delete}_own` with `user_id = auth.uid()`

### Error handling in API routes

**Source:** git HEAD `generate-from-file/route.ts`

```typescript
try {
  body = (await req.json()) as Body;
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
```

### Validation contract (Phase 1 only)

**Source:** git HEAD `src/lib/pdf/validatePdfFile.ts`

**Apply to:** `src/lib/pipeline/validation.ts` — constants and types only; no route enforcement until Phase 2.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `canonical_documents` / `canonical_sections` SQL | migration | batch | New v2.1 schema — no table in codebase; derive from CONTEXT D-04–D-06 + v1 composite-FK pattern |
| `src/lib/api/requireApiUser.ts` | middleware | request-response | New shared helper — extract from inline auth in `generate-from-file/route.ts`; no existing module |

## Metadata

**Analog search scope:** `src/lib/supabase/`, `src/lib/client/`, `src/lib/db/`, `src/app/api/`, `src/app/(app)/`, `src/app/(auth)/`, `src/components/layout/`, `supabase/migrations/`, git HEAD for deleted v1 files

**Files scanned:** ~45 (working tree + git HEAD recovery)

**Pattern extraction date:** 2026-07-25

**Working tree caveat:** `src/lib/supabase/*` and `logout/route.ts` exist in git HEAD but are absent from disk; current `src/lib/client/supabase.ts` is a mock; `src/proxy.ts` is passthrough; `(app)/layout.tsx` lacks `requireUser()`. Phase 1 execution restores git patterns and adapts for v2.1 schema.
