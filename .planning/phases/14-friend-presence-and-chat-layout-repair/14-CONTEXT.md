# Phase 14: Friend presence and chat layout repair - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning
**Source:** User request and research

<domain>
## Phase Boundary

Repair friend-list presence placement and visual state, plus chat bubble text wrapping. Preserve existing paging, realtime presence synchronization, durable history, and responsive chat routing.

</domain>

<decisions>
## Implementation Decisions

### Friend presence tabs
- Friends with `presence === "online"` appear only in Online.
- Friends with `presence === "offline"` or `presence === "recently_active"` appear only in Offline.
- Apply presence filtering before cursor/keyset pagination so each tab paginates its own complete result set.

### Offline row visuals
- Offline and recently-active rows must not render online ping/dot or online-status copy.
- Online rows retain current live presence visual treatment.

### Chat message layout
- Long normal and unbroken message text must wrap or break inside outgoing and incoming bubbles.
- Fix shared chat view used by desktop and mobile. No new dependency or realtime protocol.

### Claude's Discretion
- Exact minimal TypeScript/CSS utility choice.
- Test placement and fixtures consistent with existing social tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Social requirements
- `.planning/REQUIREMENTS.md` — SOCIAL-09 friends hub and SOCIAL-10 durable responsive messaging.
- `.planning/ROADMAP.md` — Phase 12 social UI dependency and Phase 14 success criteria.

### Phase research
- `.planning/phases/14-friend-presence-and-chat-layout-repair/14-RESEARCH.md` — exact source data flow, patterns, tests, and risks.

</canonical_refs>

<specifics>
## Specific Ideas

- Current `/api/friends` result uses `presence`/`presenceRank`, while menu filtering reads `isOnline`.
- Reuse existing presence invalidation; no client-only filtering after paginated data.
- Shared `ConversationView` bubble needs `min-w-0` plus safe word-breaking utility.

</specifics>

<deferred>
## Deferred Ideas

- New presence categories or custom recently-active presentation.
- Realtime protocol changes.

</deferred>

---

*Phase: 14-friend-presence-and-chat-layout-repair*
*Context gathered: 2026-08-01 via user request and research*
