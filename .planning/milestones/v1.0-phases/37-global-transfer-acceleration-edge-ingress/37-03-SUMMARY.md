# Phase 37 — Plan 37-03 summary

**Status:** Complete (2026-04-18)

- Documented in `pdfUploadClient.ts`: uploads use same-origin API routes; optimal latency = co-locate Next deployment and Supabase project region (presigned URLs from server). No separate client regional URL switch required for Phase 26 contract.
