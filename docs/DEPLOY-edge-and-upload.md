# Deploy: edge caching and uploads (Phase 37)

Doc2Quiz stays **local-first** by default. When you enable **Supabase** (storage + auth) and deploy on **Vercel**, these settings improve latency without changing product guarantees.

## Vercel

- Deploy the app in a **region** close to most users (dashboard → Project → Settings → Functions region is inherited by serverless routes).
- **Edge Middleware** (`src/middleware.ts`) runs at the edge; keep it lightweight — auth/session checks only.
- Static assets: `next.config.ts` sets **`Cache-Control: public, max-age=31536000, immutable`** for `/_next/static/*` (hashed build output).

## Supabase Storage

- Create buckets in the **same region** as your Vercel deployment when possible to reduce upload RTT.
- Use **HTTPS** URLs returned by the Storage API for multipart uploads; the app’s `/api/uploads/pdf/*` routes proxy capability checks — do not bypass auth.

## Local-only mode

- When `PdfUploadCapability` reports **local-only**, the client does not call multipart routes; **no** edge tuning required.

## Environment

- See `.env.example` for Supabase and upload-related variables. Prefer **regional** Supabase project URLs (`*.supabase.co`) documented in the Supabase dashboard.
