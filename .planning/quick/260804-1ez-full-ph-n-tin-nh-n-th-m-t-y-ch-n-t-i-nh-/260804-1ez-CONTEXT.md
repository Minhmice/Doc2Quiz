# Quick Task 260804-1ez: Chat media attachments and streak flame state - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Task Boundary

Add image/video attachments to direct messages with a strict 20 MB per-file limit. Store attachments in Supabase Storage. Update streak flame UI so zero/lost streak uses a bright muted state, while active or restored streak uses existing tier color.

</domain>

<decisions>
## Implementation Decisions

### Chat attachments
- Allow multiple image/video files in one message.
- Use Supabase Storage.
- Enforce 20 MB maximum per file at client and server trust boundaries.
- Preserve text-only messages.

### Streak flame
- Use bright state when `currentStreak = 0` or `lostStreak > 0`.
- Return to existing tier color after streak increases or recovery restores it.

### Claude's Discretion
- Attachment metadata shape and database migration details.
- Storage bucket/path policy implementation.
- Preview and sending UX within existing conversation layout.
- Exact bright color, chosen to remain accessible and consistent with existing palette.

</decisions>

<specifics>
## Specific Ideas

Message composer should expose file picker for image/video, show selected previews, reject files above 20 MB, and support sending attachment-only messages. Existing chat realtime remains invalidation-only.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
