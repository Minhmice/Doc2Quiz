# Research questions

## Study-together social system — 2026-07-31

1. Which existing generated-quiz table/output route is canonical source for immutable challenge snapshots, and does it already expose published/deleted/version/hash fields?
2. Which Supabase scheduling mechanism is available in deployment for the deadline-minus-24h dedupe-keyed reminder: pg_cron, Edge Function schedule, or external scheduler?
3. Which existing practice engine can accept a session snapshot route with minimal duplication while preventing answer-key access before submission?
4. Can private Supabase Broadcast authorization policies scope `social-notifications:{userId}` and `social-messages:{conversationId}` directly to recipient/participant membership, or is topic authorization mediated elsewhere?
