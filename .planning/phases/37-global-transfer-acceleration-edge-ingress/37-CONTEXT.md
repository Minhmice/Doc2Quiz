# Phase 37: Global transfer acceleration / edge ingress — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Mode:** Smart discuss — auto-accepted (recommended defaults)

<domain>
## Phase boundary

Reduce **time-to-first-byte** and **upload latency** for large PDFs and static assets by leveraging **CDN/edge** delivery and **ingress** patterns where the stack already supports them (e.g. **Supabase Storage**, **Vercel** edge), **without** breaking **local-first** defaults or requiring a new backend product.

**In scope**

- **Env-gated** improvements: correct **cache headers** for static chunks, **regional upload** URLs if offered by storage provider, **multipart** tuning (Phase 26 follow-on).
- **Documentation** for deployers (what to enable on Vercel + Supabase).

**Out of scope**

- Replacing user BYOK or adding Doc2Quiz-hosted AI.
- Multi-region replicated Postgres as a requirement.

</domain>

<decisions>
## Implementation decisions

### Product posture
- **D-37-01:** Treat acceleration as **incremental** — ship **safe** headers and URL usage first; measure before custom edge logic.

### Storage and uploads
- **D-37-02:** Prefer **provider-documented** edge/cache features for **Supabase Storage** and Next **static** assets; avoid custom domains requirement in v1.

### Local-first
- **D-37-03:** **Offline / local** paths remain unchanged; edge features apply only when **upload/sync** is active and env allows.

### Claude’s discretion
- Which routes get `revalidate` vs `force-static`; chunk sizes for multipart — follow existing Phase 26 contracts.

</decisions>

<code_context>
## Existing code insights

### Reusable assets
- Phase **26** upload init/part/complete routes and client upload session.
- `next.config` / deployment docs if present.

### Integration points
- Storage upload URLs and **middleware** — ensure CORS and auth unchanged.

</code_context>

<specifics>
## Specific ideas

- Auto-discuss: **docs + incremental headers + provider features**, no mandatory new infra.

</specifics>

<deferred>
## Deferred ideas

- Custom global POP for AI forwards — likely unnecessary; same-origin API stays.

</deferred>
