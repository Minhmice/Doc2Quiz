# Phase 13 — Avatar Reliability Rebuild

## Problem
Avatar upload remains broken in deployed Supabase: `new row violates row-level security policy`. Existing fixes are split across untracked migrations/client/API and have not been proven against target Storage policies.

## Evidence

- Browser uploads private `doc2quiz` object at `<auth.uid()>/profile/avatar.<canonical-extension>` using `upsert: true`.
- Existing baseline Storage policies authorize only `storage.objects.owner = auth.uid()`, which rejects current insert behavior.
- Current proposed fix adds exact path policies but deployment state is unknown and migration is untracked.
- UI formerly swallowed signed URL failures; now shows an error but still requires target-policy E2E proof.
- Avatar formats: PNG, JPEG, WebP, GIF; maximum 2 MiB; GIF animation must render through plain `<img>`.

## Goal
One coherent, deployed, tested avatar contract: authenticated owner selects valid image, uploads/replaces it, sees it immediately and after reload; safe friend avatar viewing keeps private storage and explicit social authorization.

## Scope

- Consolidate/sequence Storage migration safely with baseline and friend-avatar migrations.
- Avoid relying on `storage.objects.owner` for current path contract.
- Exact owner-only Storage read/insert/update/delete authorization on canonical avatar paths.
- Server profile API validates exact path and produces signed URL.
- Client exposes precise failure at upload, persistence, and signed-preview stages.
- Add migration SQL tests and browser/API-level regression coverage.
- Provide target Supabase verification steps including policy inspection and two-user isolation proof.

## Scope fences

- Never make Storage bucket public.
- Never disable RLS or grant broad `storage.objects` access.
- No arbitrary image formats, source path, file manager, cropper, or avatar history.
